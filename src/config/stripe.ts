import Stripe from 'stripe'
import config from '.'

const stripe = new Stripe(config.stripe.stripeSecretKey as string, {
  apiVersion: '2025-05-28.basil' as any,
})

export default stripe
