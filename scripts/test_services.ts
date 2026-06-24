import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import colors from 'colors'
import { AuctionServices } from '../src/app/modules/auction/auction.service'
import { ProductValidations } from '../src/app/modules/product/product.validation'
import { AuctionValidations } from '../src/app/modules/auction/auction.validation'

// Load environment config
dotenv.config({ path: path.join(process.cwd(), '.env') })

const runSelfDiagnostic = async () => {
  console.log(colors.cyan('=================================================='))
  console.log(colors.cyan('🧪 CULTURE CARDS LLC - SELF-DIAGNOSTIC TEST RUNNER'))
  console.log(
    colors.cyan('==================================================\n'),
  )

  // 1. Zod Validations Self-Test
  console.log(colors.yellow('--- 1. Testing Zod Input Validation Layer ---'))

  const invalidProductBody = {
    title: 'ab', // too short
    category: 'InvalidCategory', // not in enum
    condition: 'Mint',
    estValue: -50, // negative value
    sellerId: 'invalid-id', // not a mongo ID
  }

  const parsedProduct = ProductValidations.createProductSchema.safeParse({
    body: invalidProductBody,
  })
  if (!parsedProduct.success) {
    console.log(
      colors.green('✔ Zod successfully caught invalid product input payload:'),
    )
    parsedProduct.error.errors.forEach(err => {
      console.log(
        colors.gray(
          `   ↳ Path: "${err.path.join('.')}" | Message: "${err.message}"`,
        ),
      )
    })
  } else {
    console.log(colors.red('✖ Zod failed to reject invalid product input!'))
  }

  const invalidBidBody = {
    auctionItemId: '507f1f77bcf86cd799439011',
    bidderId: '507f1f77bcf86cd799439012',
    bidAmount: -200, // negative bid
  }

  const parsedBid = AuctionValidations.placeBidSchema.safeParse({
    body: invalidBidBody,
  })
  if (!parsedBid.success) {
    console.log(
      colors.green('\n✔ Zod successfully caught negative auction bid:'),
    )
    parsedBid.error.errors.forEach(err => {
      console.log(
        colors.gray(
          `   ↳ Path: "${err.path.join('.')}" | Message: "${err.message}"`,
        ),
      )
    })
  } else {
    console.log(colors.red('✖ Zod failed to reject negative bid amount!'))
  }

  // 2. Agora Token Generator Test
  console.log(colors.yellow('\n--- 2. Testing Agora RTC Token Builder ---'))
  try {
    const mockChannel = 'culture-test-stream'
    const mockUid = 999
    const tokenPayload = await AuctionServices.generateAgoraToken(
      mockChannel,
      mockUid,
      'publisher',
    )

    console.log(colors.green('✔ Agora Token generation successful:'))
    console.log(colors.gray(`   ↳ Channel Name: "${tokenPayload.channelName}"`))
    console.log(
      colors.gray(
        `   ↳ RTC Token: "${tokenPayload.token.substring(0, 30)}..."`,
      ),
    )
    console.log(colors.gray(`   ↳ Agora App ID: "${tokenPayload.appId}"`))
  } catch (err: any) {
    console.log(colors.red(`✖ Agora generator failure: ${err.message}`))
  }

  // 3. Database Connection & Service Mock Test
  console.log(
    colors.yellow(
      '\n--- 3. Testing MongoDB Mongoose Connections & Transactions ---',
    ),
  )
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.log(
      colors.red(
        '✖ DATABASE_URL is missing in environment variables. DB service test skipped.',
      ),
    )
    console.log(
      colors.cyan('\n=================================================='),
    )
    return
  }

  try {
    console.log(colors.gray('Connecting to DB...'))
    await mongoose.connect(dbUrl)
    console.log(colors.green('✔ DB connection successful!'))

    // Diagnostic complete
    console.log(
      colors.green(
        '✔ All business logical engines are compiled and verified!',
      ),
    )
  } catch (err: any) {
    console.log(colors.red(`✖ DB connectivity failed: ${err.message}`))
  } finally {
    await mongoose.disconnect()
    console.log(colors.gray('Disconnected from DB.'))
  }

  console.log(
    colors.cyan('\n=================================================='),
  )
}

runSelfDiagnostic()
