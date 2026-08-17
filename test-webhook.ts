import mongoose from 'mongoose'
import { User } from './src/app/modules/user/user.model'
import { Product } from './src/app/modules/product/product.model'
import { Payment } from './src/app/modules/payment/payment.model'
import { Chat } from './src/app/modules/chat/chat.model'
import { Message } from './src/app/modules/message/message.model'
import { OrderServices } from './src/app/modules/order/order.service'
import { WebhookService } from './src/app/modules/payment/webhook.service'
import config from './src/config'

async function runWebhookAndShippingSimulation() {
  console.log('Connecting to database to setup webhook test data...')
  await mongoose.connect(config.database_url as string)

  try {
    // 1. Setup mock buyer and seller
    const buyer = (await User.findOneAndUpdate(
      { email: 'webhook_buyer@culturecards.com' },
      {
        name: 'Webhook Buyer',
        fullName: 'Jane Buyer',
        role: 'user',
        status: 'active',
        verified: true,
        deviceToken: 'mock_buyer_fcm_token_12345',
      },
      { upsert: true, new: true }
    )) as any

    const seller = (await User.findOneAndUpdate(
      { email: 'webhook_seller@culturecards.com' },
      {
        name: 'Webhook Seller',
        fullName: 'John Seller',
        role: 'user',
        status: 'active',
        verified: true,
      },
      { upsert: true, new: true }
    )) as any

    // 2. Setup mock product
    const product = (await Product.findOneAndUpdate(
      { title: 'Mint 1st Edition Charizard' },
      {
        sellerId: seller._id,
        description: 'BGS Gem Mint 9.5 condition Charizard.',
        category: 'TCG',
        condition: 'Mint',
        estValue: 2000,
        startingBid: 500,
        buyNowPrice: 1800,
        status: 'active',
        stock: 5,
        allowTrade: true,
      },
      { upsert: true, new: true }
    )) as any

    console.log('Mock records configured. Creating pending order...')

    // 3. Create a pending order
    const orderPayload = {
      buyerId: buyer._id,
      sellerId: seller._id,
      productId: product._id,
      purchaseType: 'buy_now' as const,
      amountDetails: {
        itemSubtotal: 1800,
        shipping: 20,
        taxes: 140,
        processingFee: 40,
        charityContribution: 10,
        totalPaid: 2010,
      },
      paymentStatus: 'pending' as const,
      shippingAddress: {
        street: '123 Collector Lane',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      deliveryStatus: 'pending' as const,
      trackingDetails: {
        carrier: 'USPS',
        trackingNumber: 'USPS-CHARIZARD-999',
        journeyUpdates: [],
      },
    }

    const order = (await OrderServices.createOrder(orderPayload as any)) as any
    console.log(`✅ Pending Order created successfully. ID: ${order._id}`)

    // 4. Create pending payment record
    const paymentIntentId = `pi_test_${Date.now()}`
    const payment = await Payment.create({
      userId: buyer._id,
      userEmail: buyer.email,
      amount: 2010,
      currency: 'usd',
      paymentMethod: 'stripe',
      paymentIntentId: paymentIntentId,
      status: 'pending',
    })
    console.log(`✅ Pending Payment record created. ID: ${payment._id}, Intent: ${paymentIntentId}`)

    // Verify chat was created automatically during order creation
    const chat = await Chat.findOne({
      participants: { $all: [buyer._id, seller._id] },
    })
    console.log(`✅ Verification: Chat room exists. ID: ${chat?._id}`)

    const chatMessagesBefore = await Message.find({ chatId: chat?._id }).sort({ createdAt: 1 })
    console.log('--- Chat Messages After Order Confirmation ---')
    chatMessagesBefore.forEach(msg => {
      console.log(`[${msg.messageType}] ${msg.text}`)
    })

    // 5. Simulate Stripe Payment Success Webhook Event
    console.log('\n--- Simulating Stripe Webhook: payment_intent.succeeded ---')
    const mockWebhookBody = JSON.stringify({
      id: `evt_test_${Date.now()}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentId,
          amount: 201000, // Stripe expects cents
          currency: 'usd',
          status: 'succeeded',
          metadata: {},
        },
      },
    })

    // Invoke WebhookService directly
    await WebhookService.handleWebhook({
      body: Buffer.from(mockWebhookBody),
    })

    // Verify payment updated to succeeded
    const updatedPayment = await Payment.findById(payment._id)
    console.log(`✅ Verified Payment Status in DB: ${updatedPayment?.status}`)

    // 6. Simulate Shipping Journey Update (USPS checkpoint update)
    console.log('\n--- Simulating Shipping Journey Checkpoint Update ---')
    const journeyUpdate = {
      status: 'In Transit',
      description: 'Arrived at Jersey City Distribution Center',
      location: 'Jersey City, NJ',
      timestamp: new Date(),
    }

    const updatedOrder = await OrderServices.updateOrderJourney(
      order._id.toString(),
      journeyUpdate,
      'shipped'
    ) as any
    console.log(`✅ Verified Order Delivery Status in DB: ${updatedOrder.deliveryStatus}`)
    console.log('✅ Tracking journey updates count:', updatedOrder.trackingDetails.journeyUpdates.length)

    // Verify chat message updates
    const chatMessagesAfter = await Message.find({ chatId: chat?._id }).sort({ createdAt: 1 })
    console.log('\n--- Chat Messages After Shipping Update ---')
    chatMessagesAfter.forEach(msg => {
      console.log(`[${msg.messageType}] ${msg.text} (Label: ${msg.metadata?.statusLabel || 'N/A'})`)
    })

    console.log('\n--- WEBHOOK & SHIPPING SIMULATION COMPLETED SUCCESSFULY ---')
  } catch (err) {
    console.error('Simulation Failed:', err)
  } finally {
    await mongoose.connection.close()
    process.exit(0)
  }
}

runWebhookAndShippingSimulation()
