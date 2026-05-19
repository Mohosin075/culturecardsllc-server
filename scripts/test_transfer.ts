import Stripe from 'stripe'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const stripe = new Stripe(process.env.STRIPE_API_SECRET as string, {
  apiVersion: '2025-05-28.basil' as any,
})

const transferToProfessional = async (
  connectedAccountId: string,
  amount: number,
) => {
  try {
    console.log(
      `Attempting to transfer €${amount} (EUR) to ${connectedAccountId}...`,
    )

    const transfer = await stripe.transfers.create({
      amount: amount * 100, // Amount in cents
      currency: 'eur',
      destination: connectedAccountId,
      description: 'Test transfer for withdrawal verification',
    })

    console.log('✅ Transfer Successful!')
    console.log('Transfer ID:', transfer.id)
    console.log('Now you can try to withdraw from the app.')
  } catch (error: any) {
    console.error('❌ Transfer Failed:', error.message)
  }
}

// আপনার দেওয়া প্রফেশনাল আইডি এবং টেস্টিং এর জন্য $500 পাঠানো হচ্ছে
transferToProfessional('acct_1RcvK8GdOsJASBMC', 500)
