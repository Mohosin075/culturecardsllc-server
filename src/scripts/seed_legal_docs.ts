import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import config from '../config'
import { Public } from '../app/modules/public/public.model'

async function seedLegalDocs() {
  try {
    console.log('Connecting to database...')
    await mongoose.connect(config.database_url as string)
    console.log('🚀 Database connected successfully')

    const rootDir = process.cwd()
    const ccPath = path.join(rootDir, 'c&c.txt')
    const ppPath = path.join(rootDir, 'pp.txt')

    if (!fs.existsSync(ccPath)) {
      throw new Error(`Terms file not found at ${ccPath}`)
    }
    if (!fs.existsSync(ppPath)) {
      throw new Error(`Privacy policy file not found at ${ppPath}`)
    }

    const ccContent = fs.readFileSync(ccPath, 'utf-8').trim()
    const ppContent = fs.readFileSync(ppPath, 'utf-8').trim()

    // 1. Seed Terms & Conditions
    const termsResult = await Public.findOneAndUpdate(
      { type: 'terms-and-condition' },
      { $set: { content: ccContent } },
      { new: true, upsert: true },
    )
    console.log('✅ Terms & Conditions seeded successfully:', termsResult._id)

    // 2. Seed Privacy Policy
    const privacyResult = await Public.findOneAndUpdate(
      { type: 'privacy-policy' },
      { $set: { content: ppContent } },
      { new: true, upsert: true },
    )
    console.log('✅ Privacy Policy seeded successfully:', privacyResult._id)

    console.log('🎉 Legal documents seeding completed successfully!')
  } catch (error) {
    console.error('❌ Error seeding legal documents:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Database connection closed')
    process.exit(0)
  }
}

seedLegalDocs()
