import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { User } from '../src/app/modules/user/user.model'
import { Category } from '../src/app/modules/category/category.model'
import { Support } from '../src/app/modules/support/support.model'
import { Notification } from '../src/app/modules/notification/notification.model'
import {
  NotificationType,
  NotificationStatus,
  NotificationPriority,
} from '../src/app/modules/notification/notification.interface'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const seedRealData = async () => {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL is missing in env variables')
    return
  }

  try {
    console.log('Connecting to database...')
    await mongoose.connect(dbUrl)
    console.log('Connected to database!')

    // 1. Get or create users to link to our records
    let users = await User.find({ status: 'active' }).limit(10)
    if (users.length === 0) {
      console.log('No active users found. Creating mock users...')
      const u1 = await User.create({
        name: 'AlexTrader',
        fullName: 'Alex Trader',
        email: 'alex.trader@example.com',
        password: 'Password123!',
        roles: ['buyer', 'seller'],
        status: 'active',
        verified: true,
      })
      const u2 = await User.create({
        name: 'SarahCollector',
        fullName: 'Sarah Collector',
        email: 'sarah.collector@example.com',
        password: 'Password123!',
        roles: ['buyer'],
        status: 'active',
        verified: true,
      })
      users = [u1, u2] as any[]
    }
    const userA = users[0]
    const userB = users[1] || users[0]

    console.log(`Using users for seeding: ${userA.email} and ${userB.email}`)

    // 2. Seed Categories if empty
    const categoryCount = await Category.countDocuments()
    if (categoryCount === 0) {
      console.log('Seeding Categories...')
      const sneakers = await Category.create({
        name: 'Sneakers',
        description: 'Collectible footwear, vintage kicks, and streetwear collaborations.',
        icon: 'Footprints',
        type: 'category',
        isPopular: true,
        isActive: true,
      })
      const cards = await Category.create({
        name: 'Trading Cards',
        description: 'Pokemon, sports cards, Magic: The Gathering, and TCG collectibles.',
        icon: 'Cards',
        type: 'category',
        isPopular: true,
        isActive: true,
      })
      const watches = await Category.create({
        name: 'Watches',
        description: 'Luxury chronographs, vintage timepieces, and modern luxury watches.',
        icon: 'Watch',
        type: 'category',
        isPopular: true,
        isActive: true,
      })
      const tech = await Category.create({
        name: 'Tech',
        description: 'High-end consumer electronics, modern gaming setups, and smart tech.',
        icon: 'Laptop',
        type: 'category',
        isPopular: false,
        isActive: true,
      })

      // Add subcategories
      await Category.create({
        name: 'Nike',
        parent: sneakers._id,
        type: 'subcategory',
        isActive: true,
      })
      await Category.create({
        name: 'Adidas',
        parent: sneakers._id,
        type: 'subcategory',
        isActive: true,
      })
      await Category.create({
        name: 'Pokemon',
        parent: cards._id,
        type: 'subcategory',
        isActive: true,
      })
      await Category.create({
        name: 'Sports Cards',
        parent: cards._id,
        type: 'subcategory',
        isActive: true,
      })
      await Category.create({
        name: 'Rolex',
        parent: watches._id,
        type: 'subcategory',
        isActive: true,
      })
      console.log('Categories seeded successfully!')
    } else {
      console.log('Categories already exist in database.')
    }

    // 3. Seed Disputes/Support if empty
    const disputeCount = await Support.countDocuments()
    if (disputeCount === 0) {
      console.log('Seeding Disputes...')
      await Support.create({
        userId: userA._id,
        reportedUser: userB._id,
        reason: 'fraud',
        priority: 'high',
        subject: 'Item not as described',
        message: 'The Nike Air Jordan sneakers received contain deep crease marks not advertised in listing photos.',
        status: 'pending',
      })
      await Support.create({
        userId: userB._id,
        reportedUser: userA._id,
        reason: 'spam',
        priority: 'medium',
        subject: 'Inappropriate chat behaviour',
        message: 'The buyer is sending multiple threatening messages demanding immediate shipment before payout processing.',
        status: 'pending',
      })
      console.log('Disputes seeded successfully!')
    } else {
      console.log('Disputes already exist in database.')
    }

    // 4. Seed Notifications if empty
    const notificationCount = await Notification.countDocuments()
    if (notificationCount === 0) {
      console.log('Seeding System Notifications...')
      await Notification.create({
        userId: userA._id,
        title: 'New Order Placed',
        content: 'Your listing "Nike Air Jordan 1" has been purchased for $320. Pack it up!',
        type: NotificationType.SYSTEM_ALERT,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.MEDIUM,
        isRead: false,
      })
      await Notification.create({
        userId: userA._id,
        title: 'Trade Request Accepted',
        content: 'Sarah Collector has accepted your trade offer for Charizard Base Set.',
        type: NotificationType.NEW_MESSAGE,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        isRead: false,
      })
      await Notification.create({
        userId: userA._id,
        title: 'Security Alert: New Login',
        content: 'A new login attempt was detected from IP 192.168.1.15 on Chrome (Windows).',
        type: NotificationType.SYSTEM_ALERT,
        status: NotificationStatus.SENT,
        priority: NotificationPriority.MEDIUM,
        isRead: true,
      })
      console.log('Notifications seeded successfully!')
    } else {
      console.log('Notifications already exist in database.')
    }

    // 5. Seed Pending Seller Verification Requests if empty
    const pendingSellersCount = await User.countDocuments({
      roles: 'seller',
      verified: false,
    })
    if (pendingSellersCount === 0) {
      console.log('Seeding Pending Seller Verification Requests...')
      await User.create({
        name: 'MarcusBrody',
        fullName: 'Marcus Brody',
        email: 'marcus.brody@antiquities.com',
        password: 'Password123!',
        roles: ['seller'],
        status: 'active',
        verified: false,
        specialty: 'Watches & Chronographs',
      })
      await User.create({
        name: 'ElenaRostova',
        fullName: 'Elena Rostova',
        email: 'elena@luxurycards.io',
        password: 'Password123!',
        roles: ['seller'],
        status: 'active',
        verified: false,
        specialty: 'Trading Cards',
      })
      await User.create({
        name: 'TylerDurden',
        fullName: 'Tyler Durden',
        email: 'tyler@streetwear.co',
        password: 'Password123!',
        roles: ['seller'],
        status: 'active',
        verified: false,
        specialty: 'Sneakers & Streetwear',
      })
      console.log('Pending Seller Verification Requests seeded successfully!')
    } else {
      console.log('Pending Seller Verification Requests already exist.')
    }

    console.log('Seeding completed successfully!')
  } catch (error) {
    console.error('Error seeding data:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from database.')
  }
}

seedRealData()
