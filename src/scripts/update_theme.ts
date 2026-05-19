import mongoose from 'mongoose'
import config from '../config'
import { Category } from '../app/modules/category/category.model'

async function updateTheme() {
  try {
    // Connect to database
    await mongoose.connect(config.database_url as string)
    console.log('🚀 Database connected successfully')

    const oldTheme = 'EDITING & POST-PRODUCTION'
    const newTheme = 'EDITING AND POST-PRODUCTION'

    // 1. Get categories with the old theme
    const categories = await Category.find({ theme: oldTheme })
    console.log(
      `🔍 Found ${categories.length} categories with theme: "${oldTheme}"`,
    )

    if (categories.length > 0) {
      console.log('📋 Categories to be updated:')
      categories.forEach(cat =>
        console.log(`   - ${cat.name} (ID: ${cat._id})`),
      )

      // 2. Update them
      const result = await Category.updateMany(
        { theme: oldTheme },
        { $set: { theme: newTheme } },
      )

      console.log(
        `✅ Update result: ${result.modifiedCount} documents updated.`,
      )
      console.log(`🎉 Successfully updated to: "${newTheme}"`)
    } else {
      console.log('ℹ️ No categories found with that theme.')
    }
  } catch (error) {
    console.error('❌ Error during update:', error)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Database connection closed')
    process.exit(0)
  }
}

updateTheme()
