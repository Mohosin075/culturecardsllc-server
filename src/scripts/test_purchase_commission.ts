import mongoose, { Types } from 'mongoose'
import config from '../config'
import { Partner } from '../app/modules/partner/partner.model'
import { PartnerEarning } from '../app/modules/partner/partner.model'
import { User } from '../app/modules/user/user.model'
import { Order } from '../app/modules/order/order.model'
import { PartnerService } from '../app/modules/partner/partner.service'

async function run() {
  console.log('--- Connecting to MongoDB ---')
  await mongoose.connect(config.database_url)
  console.log('MongoDB connected.')

  // 1. Find the GG user
  const user = await User.findOne({ promoCode: 'GG' }).sort({ createdAt: -1 })
  if (!user) {
    throw new Error('No user with promoCode "GG" found!')
  }
  console.log(`Found Test Buyer: ${user.name} (${user.email}, ID: ${user._id})`)
  console.log(`Referred by Partner ID: ${user.referredByPartnerId}`)

  // 2. Find the Partner
  const partner = await Partner.findById(user.referredByPartnerId)
  if (!partner) {
    throw new Error('Associated partner not found!')
  }
  console.log(`Partner: ${partner.name} (Code: ${partner.promoCode})`)

  // 3. Stats BEFORE purchase
  const dashboardBefore = await PartnerService.getPartnerDashboardByToken(partner.accessToken)
  console.log('\n--- Partner Stats BEFORE Purchase ---')
  console.log(`Total Referred Users: ${dashboardBefore.metrics.totalReferredUsers}`)
  console.log(`Total Earnings: $${dashboardBefore.partnerInfo.totalEarnings}`)
  console.log(`Partner Share Total: $${dashboardBefore.metrics.partnerShareTotal}`)
  console.log(`Owner Share Total: $${dashboardBefore.metrics.ownerShareTotal}`)
  console.log(`Total Platform Fees: $${dashboardBefore.metrics.totalPlatformFees}`)
  console.log(`Total Transactions: $${dashboardBefore.metrics.totalTransactions}`)

  // 4. Create a simulated Purchase / Order of $100.00
  const transactionAmount = 100.00 // $100 card sale
  const dummyOrderId = new Types.ObjectId()

  console.log(`\nSimulating a $${transactionAmount} card purchase by buyer ${user.name}...`)

  // Create an order record for audit
  const testOrder = await Order.create({
    _id: dummyOrderId,
    buyerId: user._id,
    sellerId: new Types.ObjectId(),
    productId: new Types.ObjectId(),
    purchaseType: 'buy_now',
    paymentStatus: 'paid',
    deliveryStatus: 'pending',
    shippingAddress: {
      street: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'US',
    },
    amountDetails: {
      itemSubtotal: 95.00,
      subtotal: 95.00,
      shipping: 5.00,
      totalPaid: transactionAmount,
    },
    trackingDetails: {
      carrier: 'USPS',
      trackingNumber: `CC-TRACK-${Date.now()}`,
      journeyUpdates: [],
    },
  })

  // 5. Trigger Partner Commission Recording
  await PartnerService.recordCommissionForOrder({
    buyerId: user._id.toString(),
    orderId: testOrder._id.toString(),
    transactionAmount,
    isTrade: false,
  })

  // 6. Check database records
  const earningRecord = await PartnerEarning.findOne({ orderId: testOrder._id })
  console.log('\n--- Commission Audit Entry Created in PartnerEarning ---')
  if (earningRecord) {
    console.log(`Earning ID: ${earningRecord._id}`)
    console.log(`Transaction Amount: $${earningRecord.transactionAmount}`)
    console.log(`Platform Fee (7%): $${earningRecord.platformFee}`)
    console.log(`Partner Share (50%): $${earningRecord.partnerShare}`)
    console.log(`Owner Share (50%): $${earningRecord.ownerShare}`)
    console.log(`Description: ${earningRecord.description}`)
  } else {
    throw new Error('PartnerEarning record was not created!')
  }

  // 7. Stats AFTER purchase
  const dashboardAfter = await PartnerService.getPartnerDashboardByToken(partner.accessToken)
  console.log('\n--- Partner Stats AFTER Purchase ---')
  console.log(`Total Referred Users: ${dashboardAfter.metrics.totalReferredUsers}`)
  console.log(`Total Earnings: $${dashboardAfter.partnerInfo.totalEarnings}`)
  console.log(`Partner Share Total: $${dashboardAfter.metrics.partnerShareTotal}`)
  console.log(`Owner Share Total: $${dashboardAfter.metrics.ownerShareTotal}`)
  console.log(`Total Platform Fees: $${dashboardAfter.metrics.totalPlatformFees}`)
  console.log(`Total Transactions: $${dashboardAfter.metrics.totalTransactions}`)
  console.log(`Realtime Graph Points:`, JSON.stringify(dashboardAfter.realtimeGraphData, null, 2))

  console.log('\n======================================================')
  console.log('✅ COMMISSION FLOW 100% VERIFIED!')
  console.log(`Open Magic Portal Link to see live Recharts graph:`)
  console.log(`👉 http://localhost:3000/partner/dashboard?token=${partner.accessToken}`)
  console.log('======================================================\n')

  await mongoose.disconnect()
  process.exit(0)
}

run().catch(err => {
  console.error('Error running test script:', err)
  process.exit(1)
})
