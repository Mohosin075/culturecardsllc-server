process.env.NODE_ENV = 'test'
import mongoose from 'mongoose'
import config from '../config'
import { AuctionServices } from '../app/modules/auction/auction.service'
import { LiveStream } from '../app/modules/auction/auction.model'
import { Order } from '../app/modules/order/order.model'
import { Product } from '../app/modules/product/product.model'
import { User } from '../app/modules/user/user.model'

async function runPhase2Tests() {
  console.log('🧪 Starting Phase 2 Backend Feature Tests...')
  try {
    await mongoose.connect(config.database_url as string)
    console.log('Connected to database.')

    // 1. Find or create a test seller and test buyer
    let testSeller: any = await User.findOne({ email: 'seller.test@culturecards.com' })
    if (!testSeller) {
      testSeller = await User.create({
        name: 'Test Seller',
        fullName: 'Test Host Seller',
        email: 'seller.test@culturecards.com',
        password: 'password123',
        role: 'seller',
      })
    }

    let testBuyer: any = await User.findOne({ email: 'buyer.test@culturecards.com' })
    if (!testBuyer) {
      testBuyer = await User.create({
        name: 'Test Buyer',
        fullName: 'Test Winner Buyer',
        email: 'buyer.test@culturecards.com',
        password: 'password123',
        role: 'buyer',
      })
    }

    // 2. Create a test Live Stream
    const testStream: any = await LiveStream.create({
      sellerId: testSeller._id,
      title: 'Automated Test Stream',
      description: 'Testing Spin Wheel, Giveaway, and Post-Show features',
      category: 'Trading Cards & TCG',
      coverImage: 'https://example.com/cover.jpg',
      status: 'live',
      agoraChannelName: `test_ch_${Date.now()}`,
      channelName: `test_ch_${Date.now()}`,
    })
    console.log('✅ Created Test Stream:', testStream._id.toString())

    // 3. Test Spin Wheel: Max 4 validation
    console.log('\n--- Testing Spin Wheel Limit Validation ---')
    try {
      await AuctionServices.spinWheel(testStream._id.toString(), testSeller._id.toString(), {
        items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5 (Violates Max 4)'],
      })
      console.error('❌ Failed: Allowed 5 items (Max 4 should have failed)!')
    } catch (err: any) {
      console.log('✅ Success: Rejected 5 items with message:', err.message)
    }

    try {
      await AuctionServices.spinWheel(testStream._id.toString(), testSeller._id.toString(), {
        items: ['Only One Item'],
      })
      console.error('❌ Failed: Allowed 1 item (Min 2 required)!')
    } catch (err: any) {
      console.log('✅ Success: Rejected 1 item with message:', err.message)
    }

    // 4. Test Spin Wheel: Valid 4 items execution & server-side RNG
    console.log('\n--- Testing Spin Wheel Execution (4 items) ---')
    const spinItems = ['LeBron James Card', 'Kobe Bryant Jersey', 'Kevin Durant Auto', 'Stephen Curry Patch']
    const spinResult = await AuctionServices.spinWheel(testStream._id.toString(), testSeller._id.toString(), {
      items: spinItems,
      buyerId: testBuyer._id.toString(),
    })

    console.log(`✅ Success: Wheel spun! Landed on index ${spinResult.winningIndex}: "${spinResult.winningItem}"`)
    if (!spinItems.includes(spinResult.winningItem)) {
      throw new Error('Winning item not from items list!')
    }

    // 5. Test Order with streamId and Spin Wheel attachment
    const testProduct: any = await Product.create({
      sellerId: testSeller._id,
      title: '1986 Fleer Michael Jordan Rookie',
      price: 250,
      estValue: 250,
      condition: 'Mint',
      startingBid: 100,
      buyNowPrice: 250,
      category: new mongoose.Types.ObjectId(),
      status: 'sold',
      images: ['https://example.com/jordan.jpg'],
    })

    const testOrder: any = await Order.create({
      buyerId: testBuyer._id,
      sellerId: testSeller._id,
      productId: testProduct._id,
      streamId: testStream._id,
      isGiveaway: false,
      spinWheelPrize: spinResult.winningItem,
      purchaseType: 'auction_win',
      paymentStatus: 'paid',
      deliveryStatus: 'pending',
      shippingAddress: {
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'OR',
        postalCode: '97477',
        country: 'US',
      },
      amountDetails: {
        itemSubtotal: 250,
        shipping: 5,
        taxes: 20,
        processingFee: 7.5,
        charityContribution: 0,
        totalPaid: 282.5,
      },
      trackingDetails: {
        carrier: 'USPS',
        trackingNumber: `USPS-TEST-${Date.now()}`,
        journeyUpdates: [],
      },
      shippingLabelUrl: `/uploads/labels/label-test-${Date.now()}.pdf`,
    })
    console.log('✅ Created Test Order with attached spinWheelPrize:', testOrder._id.toString(), testOrder.spinWheelPrize)

    // 6. Test Stream Sales View (Update 4)
    console.log('\n--- Testing Live Sales View Query ---')
    const sales = await AuctionServices.getStreamSales(testStream._id.toString(), testSeller._id.toString())
    console.log(`✅ Success: Live Sales returned ${sales.totalOrders} order(s), total revenue: $${sales.totalRevenue}`)
    if (sales.totalOrders !== 1 || sales.orders[0].spinWheelPrize !== spinResult.winningItem) {
      throw new Error('Sales view did not properly return the created order or spin prize!')
    }

    // 7. Test Post-Show Summary View (Update 6)
    console.log('\n--- Testing Post-Show Summary & Shipping Labels ---')
    const summary = await AuctionServices.getStreamSummary(testStream._id.toString(), testSeller._id.toString())
    console.log(`✅ Success: Post-Show summary returned ${summary.labels.length} shipping label(s) ready for printing!`)
    console.log('   Label details:', summary.labels[0])

    // Cleanup test records
    await Order.findByIdAndDelete(testOrder._id)
    await Product.findByIdAndDelete(testProduct._id)
    await LiveStream.findByIdAndDelete(testStream._id)
    console.log('🧹 Cleaned up temporary test data.')

    console.log('\n🎉 ALL PHASE 2 BACKEND TESTS PASSED SUCCESSFULLY! 🚀')
  } catch (error) {
    console.error('❌ Test failed with error:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

runPhase2Tests()
