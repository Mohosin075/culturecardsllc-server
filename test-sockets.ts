import mongoose from 'mongoose'
import { io as Client } from 'socket.io-client'
import { User } from './src/app/modules/user/user.model'
import { Product } from './src/app/modules/product/product.model'
import { LiveStream, AuctionItem } from './src/app/modules/auction/auction.model'
import config from './src/config'

const PORT = Number(config.port) || 5000
const SERVER_URL = `http://localhost:${PORT}`

async function setupMockData() {
  console.log('Connecting to database to setup mock data...')
  await mongoose.connect(config.database_url as string)

  // 1. Setup mock users
  const seller = (await User.findOneAndUpdate(
    { email: 'test_seller@culturecards.com' },
    {
      name: 'Test Seller',
      fullName: 'Test Seller Host',
      role: 'user',
      status: 'active',
      verified: true,
    },
    { upsert: true, new: true }
  )) as any

  const bidder1 = (await User.findOneAndUpdate(
    { email: 'test_bidder1@culturecards.com' },
    {
      name: 'Bidder One',
      fullName: 'Bidder One Test',
      role: 'user',
      status: 'active',
      verified: true,
    },
    { upsert: true, new: true }
  )) as any

  const bidder2 = (await User.findOneAndUpdate(
    { email: 'test_bidder2@culturecards.com' },
    {
      name: 'Bidder Two',
      fullName: 'Bidder Two Test',
      role: 'user',
      status: 'active',
      verified: true,
    },
    { upsert: true, new: true }
  )) as any

  // 2. Setup mock product
  const product = (await Product.findOneAndUpdate(
    { title: 'Vintage Pikachu Card 1999' },
    {
      sellerId: seller._id,
      description: 'Extremely rare holographic mint condition card.',
      category: 'TCG',
      condition: 'Mint',
      estValue: 500,
      startingBid: 100,
      reservePrice: 250,
      buyNowPrice: 450,
      status: 'active',
      stock: 1,
      allowTrade: true,
    },
    { upsert: true, new: true }
  )) as any

  // 3. Setup mock live stream
  const stream = (await LiveStream.findOneAndUpdate(
    { title: 'Mega Card Auction Night!' },
    {
      sellerId: seller._id,
      description: 'TCG and sports card break events.',
      status: 'live',
      agoraChannelName: 'test_channel_123',
      pinnedProductId: product._id,
      viewersCount: 0,
      likesCount: 0,
    },
    { upsert: true, new: true }
  )) as any

  // 4. Setup mock auction item
  const auctionItem = (await AuctionItem.findOneAndUpdate(
    { productId: product._id },
    {
      streamId: stream._id,
      status: 'active',
      currentBid: 100,
      highestBidderId: null,
      bidIncrement: 10,
      timerDuration: 60,
      endsAt: new Date(Date.now() + 60 * 1000), // 1 minute from now
    },
    { upsert: true, new: true }
  )) as any

  console.log('Mock database records established successfully!')
  return {
    sellerId: seller._id.toString(),
    bidder1Id: bidder1._id.toString(),
    bidder2Id: bidder2._id.toString(),
    streamId: stream._id.toString(),
    auctionItemId: auctionItem._id.toString(),
  }
}

async function runSocketSimulation() {
  let ids: any
  try {
    ids = await setupMockData()
  } catch (err) {
    console.error('Error establishing database records:', err)
    process.exit(1)
  }

  console.log(`\nConnecting client sockets to server: ${SERVER_URL}`)
  
  // Connect Seller
  const sellerSocket = Client(SERVER_URL)
  // Connect Bidder 1
  const bidder1Socket = Client(SERVER_URL)
  // Connect Bidder 2
  const bidder2Socket = Client(SERVER_URL)

  let completedTests = 0
  const totalExpectedTests = 6

  const checkFinish = () => {
    completedTests++
    if (completedTests >= totalExpectedTests) {
      console.log('\n--- SOCKET SIMULATION RUN COMPLETED SUCCESSFULY ---')
      sellerSocket.disconnect()
      bidder1Socket.disconnect()
      bidder2Socket.disconnect()
      mongoose.connection.close()
      process.exit(0)
    }
  }

  // --- CLIENT 1: SELLER ---
  sellerSocket.on('connect', () => {
    console.log(`[Host connected] socketID: ${sellerSocket.id}`)
    sellerSocket.emit('join-stream', { streamId: ids.streamId, userId: ids.sellerId })
  })

  sellerSocket.on('viewer-count-update', (data) => {
    console.log(`[Viewer count updated]: Stream viewers count is now ${data.viewersCount}`)
  })

  sellerSocket.on('spin-result', (data) => {
    console.log(`[Spin result received!]: Prize: "${data.prizeName}" [${data.rarity}] at spin degree: ${data.degreeIndex}`)
    checkFinish()
  })

  // --- CLIENT 2: BIDDER ONE ---
  bidder1Socket.on('connect', () => {
    console.log(`[Bidder 1 connected] socketID: ${bidder1Socket.id}`)
    bidder1Socket.emit('join-stream', { streamId: ids.streamId, userId: ids.bidder1Id })

    // Simulate sending reactions & messages
    setTimeout(() => {
      console.log('[Bidder 1] Emitting stream-reaction (heart)...')
      bidder1Socket.emit('stream-reaction', { streamId: ids.streamId, reactionType: 'heart' })
    }, 1000)

    setTimeout(() => {
      console.log('[Bidder 1] Emitting stream-chat (Hello host!)...')
      bidder1Socket.emit('stream-chat', { streamId: ids.streamId, userId: ids.bidder1Id, message: 'Hello host!' })
    }, 2000)

    // Simulate placing a bid
    setTimeout(() => {
      console.log('[Bidder 1] Placing bid of $150...')
      bidder1Socket.emit('place-bid', {
        streamId: ids.streamId,
        auctionItemId: ids.auctionItemId,
        bidAmount: 150,
        bidderId: ids.bidder1Id,
      })
    }, 3000)

    // Simulate concurrent bidding collision check
    setTimeout(() => {
      console.log('[Collision Test] Bidder 1 & Bidder 2 placing same bid ($200) concurrently...')
      bidder1Socket.emit('place-bid', {
        streamId: ids.streamId,
        auctionItemId: ids.auctionItemId,
        bidAmount: 200,
        bidderId: ids.bidder1Id,
      })
      bidder2Socket.emit('place-bid', {
        streamId: ids.streamId,
        auctionItemId: ids.auctionItemId,
        bidAmount: 200,
        bidderId: ids.bidder2Id,
      })
    }, 5000)
  })

  bidder1Socket.on('new-reaction', (data) => {
    console.log(`[Reaction received]: Reaction type: ${data.reactionType}, Total stream likes: ${data.likesCount}`)
    checkFinish()
  })

  bidder1Socket.on('new-chat-message', (data) => {
    console.log(`[Chat message received]: ${data.user.name}: "${data.message}"`)
    checkFinish()
  })

  bidder1Socket.on('new-bid', (data) => {
    console.log(`[New high bid registered!]: New bid amount: $${data.currentBid} by ${data.highestBidder?.name}`)
    checkFinish()
  })

  bidder2Socket.on('bid-error', (data) => {
    console.log(`[Bid error received (expected check)]: ${data.message}`)
    checkFinish()
  })

  // --- CLIENT 3: BIDDER TWO ---
  bidder2Socket.on('connect', () => {
    console.log(`[Bidder 2 connected] socketID: ${bidder2Socket.id}`)
    bidder2Socket.emit('join-stream', { streamId: ids.streamId, userId: ids.bidder2Id })
  })

  // Host triggers spin wheel after bidding flows
  setTimeout(() => {
    console.log('[Host] Triggering Seller Spin Wheel...')
    sellerSocket.emit('trigger-spin', { streamId: ids.streamId, sellerId: ids.sellerId })
  }, 7000)
}

runSocketSimulation()
