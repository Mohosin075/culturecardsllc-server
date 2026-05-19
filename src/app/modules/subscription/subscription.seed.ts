import { SubscriptionPlan } from './subscription-plan.model'
import { stripeService } from './stripe.service'

// Default subscription plans for Photopya
const defaultPlans = [
  {
    name: 'Free Plan',
    description: 'Basic access for photographers',
    price: 0,
    currency: 'eur',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 0,
    features: [
      'Create professional profile',
      'List up to 5 services',
      'Basic booking management',
      'Public profile visibility',
      'Standard support',
    ],
    maxTeamMembers: 1,
    maxServices: 5,
    userTypes: ['professional'],
    priority: 1,
  },
  {
    name: 'Monthly Plan',
    description: 'Full access for growing professionals',
    price: 14.99,
    currency: 'eur',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Everything in Free',
      'List up to 20 services',
      'Enhanced portfolio features',
      'Featured in search results',
      'Advanced booking analytics',
    ],
    maxTeamMembers: 2,
    maxServices: 20,
    userTypes: ['professional'],
    priority: 2,
  },
  {
    name: 'Yearly Plan',
    description: 'Best value for established studios',
    price: 99.99,
    currency: 'eur',
    interval: 'year' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Everything in Monthly',
      'Unlimited service listings',
      'Priority platform support',
      'Early access to new features',
      'Custom branding options',
      'Studio management tools',
    ],
    maxTeamMembers: 5,
    maxServices: 999,
    userTypes: ['professional'],
    priority: 3,
  },
]

export async function seedSubscriptionPlans(): Promise<void> {
  try {
    console.log('Starting subscription plans seeding...')

    // Check if plans already exist
    const existingPlansCount = await SubscriptionPlan.countDocuments()
    if (existingPlansCount > 0) {
      console.log(
        `${existingPlansCount} subscription plans already exist. Skipping seed.`,
      )
      return
    }

    // Create plans in Stripe and database
    for (const planData of defaultPlans) {
      try {
        // Create Stripe product
        const stripeProduct = await stripeService.createProduct({
          name: planData.name,
          description: planData.description,
          metadata: {
            userTypes: planData.userTypes.join(','),
            maxTeamMembers: planData.maxTeamMembers.toString(),
            maxServices: planData.maxServices.toString(),
          },
        })

        // Create Stripe price
        const stripePrice = await stripeService.createPrice({
          productId: stripeProduct.id,
          unitAmount: Math.round(planData.price * 100), // Convert to cents
          currency: planData.currency,
          interval: planData.interval,
          intervalCount: planData.intervalCount,
          metadata: {
            planName: planData.name,
          },
        })

        // Create local plan
        const plan = new SubscriptionPlan({
          ...planData,
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice.id,
          isActive: true,
        })

        await plan.save()
        console.log(`Created subscription plan: ${planData.name}`)
      } catch (error) {
        console.error(`Error creating plan ${planData.name}:`, error)
        // Continue with other plans even if one fails
      }
    }

    console.log('Subscription plans seeding completed successfully')
  } catch (error) {
    console.error('Error seeding subscription plans:', error)
    throw error
  }
}

// Function to update existing plans (for migrations)
export async function updateSubscriptionPlans(): Promise<void> {
  try {
    console.log('Updating subscription plans...')

    // Add any plan updates here
    // Example: Update features for existing plans

    console.log('Subscription plans update completed')
  } catch (error) {
    console.error('Error updating subscription plans:', error)
    throw error
  }
}

// Function to create a specific plan (for testing or manual creation)
export async function createSpecificPlan(planData: any): Promise<void> {
  try {
    // Create Stripe product
    const stripeProduct = await stripeService.createProduct({
      name: planData.name,
      description: planData.description,
      metadata: planData.metadata || {},
    })

    // Create Stripe price
    const stripePrice = await stripeService.createPrice({
      productId: stripeProduct.id,
      unitAmount: Math.round(planData.price * 100),
      currency: planData.currency,
      interval: planData.interval,
      intervalCount: planData.intervalCount || 1,
    })

    // Create local plan
    const plan = new SubscriptionPlan({
      ...planData,
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id,
    })

    await plan.save()
    console.log(`Created specific plan: ${planData.name}`)
  } catch (error) {
    console.error(`Error creating specific plan:`, error)
    throw error
  }
}
