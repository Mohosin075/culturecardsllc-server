import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { User } from '../src/app/modules/user/user.model'
import { LiveStream } from '../src/app/modules/auction/auction.model'

dotenv.config({ path: path.join(__dirname, '../.env') })

const run = async () => {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL is missing')
    process.exit(1)
  }

  try {
    console.log('Connecting to database...')
    await mongoose.connect(dbUrl)
    console.log('Connected!')

    // Find any user, or create one if none exist
    let seller = await User.findOne({ roles: 'seller' })
    if (!seller) {
      seller = await User.findOne()
    }
    if (!seller) {
      console.log('No user found, creating a mock seller...')
      seller = await User.create({
        name: 'MockSeller',
        fullName: 'Mock Seller Name',
        email: `mock.seller.${Date.now()}@example.com`,
        password: 'Password123!',
        roles: ['seller'],
        status: 'active',
        isOnline: true,
      })
    }

    console.log(`Using Seller ID: ${seller._id} (${seller.name})`)

    const channelName = `live-channel-${Date.now()}`
    const liveStream = await LiveStream.create({
      sellerId: seller._id,
      title: 'Rare Collectibles Live Auction Stream',
      description: 'Auctioning some of the rarest items right now!',
      status: 'live',
      agoraChannelName: channelName,
      viewersCount: Math.floor(Math.random() * 100) + 15,
    })

    console.log('Successfully created a live stream in the database:')
    console.log(JSON.stringify(liveStream, null, 2))

  } catch (error) {
    console.error('Error running script:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected.')
  }
}

run()
