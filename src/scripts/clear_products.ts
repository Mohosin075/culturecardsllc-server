import mongoose from 'mongoose'
import config from '../config'
import { Product } from '../app/modules/product/product.model'

async function clearExistingInventory() {
  try {
    console.log('Connecting to database...')
    await mongoose.connect(config.database_url as string)
    console.log('🚀 Database connected successfully')

    const count = await Product.countDocuments()
    console.log(`Found ${count} products in database. Removing them from Trade Marketplace & Featured Collectibles...`)

    const result = await Product.deleteMany({})
    console.log(`✅ Successfully removed ${result.deletedCount} products from database!`)
    console.log('✨ Mock community voting trades were kept untouched.')
  } catch (error) {
    console.error('❌ Error clearing products:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Database disconnected.')
    process.exit(0)
  }
}

clearExistingInventory()
