/**
 * Seed a test seller and a test buyer into a LOCAL database.
 *
 *   npx ts-node --transpile-only src/scripts/seed_local_test_users.ts
 *
 * Refuses to run unless DATABASE_URL points at localhost. The password comes
 * from LOCAL_TEST_PASSWORD, or is generated and written to `.env.testusers`
 * (git-ignored by the `.env.*` rule) so it never needs to be pasted anywhere.
 */
import 'dotenv/config'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { User } from '../app/modules/user/user.model'
import { USER_ROLES } from '../enum/user'

const dbUrl = process.env.DATABASE_URL || ''
if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.error('Refusing to seed: DATABASE_URL is not a localhost database.')
  process.exit(1)
}

const credsFile = path.join(process.cwd(), '.env.testusers')
const password =
  process.env.LOCAL_TEST_PASSWORD || crypto.randomBytes(9).toString('base64url')

const users = [
  {
    email: 'seller.local@test.areis',
    name: 'Local Seller',
    username: 'localseller',
    roles: [USER_ROLES.BUYER, USER_ROLES.SELLER],
    activeRole: USER_ROLES.SELLER,
    sellerVerified: true,
    shipFromAddress: {
      name: 'Local Seller',
      street1: '417 Montgomery St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94104',
      country: 'US',
      phone: '4155550100',
    },
  },
  {
    email: 'buyer.local@test.areis',
    name: 'Local Buyer',
    username: 'localbuyer',
    roles: [USER_ROLES.BUYER],
    activeRole: USER_ROLES.BUYER,
    sellerVerified: false,
    address: {
      city: 'New York',
      postalCode: '10001',
      country: 'US',
      presentAddress: '350 5th Ave',
      permanentAddress: '350 5th Ave',
    },
  },
]

const run = async () => {
  await mongoose.connect(dbUrl)
  for (const data of users) {
    await User.deleteOne({ email: data.email })
    await User.create({
      ...data,
      password,
      verified: true,
      isOnboardingComplete: true,
    })
    console.log(`seeded ${data.email}`)
  }
  fs.writeFileSync(
    credsFile,
    users.map(u => `# ${u.name}\n${u.email}`).join('\n') +
      `\nLOCAL_TEST_PASSWORD=${password}\n`,
  )
  console.log(`credentials written to ${credsFile}`)
  await mongoose.disconnect()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
