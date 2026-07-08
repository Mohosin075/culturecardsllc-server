import { z } from 'zod'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

// ------------------ SUB-SCHEMAS ------------------
const addressSchema = z.object({
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  permanentAddress: z.string().optional(),
  presentAddress: z.string().optional(),
})

const pointSchema = z.object({
  type: z.literal('Point').default('Point'),
  coordinates: z.tuple([z.number(), z.number()]).optional(), // [longitude, latitude]
})

// ------------------ UPDATE USER VALIDATION ------------------
export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    username: z.string().optional(),
    profile: z.string().optional(),
    coverPhoto: z.string().optional(),
    phone: z.string().optional(),
    description: z.string().optional(),
    specialty: z.string().optional(),

    address: addressSchema.optional(),
    location: pointSchema.optional(),

    appId: z.string().optional(),
    deviceToken: z.string().optional(),
  }),
})

export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(USER_STATUS).optional(),
    verified: z.boolean().optional(),
  }),
})

export const switchRoleSchema = z.object({
  body: z.object({
    role: z.enum([USER_ROLES.BUYER, USER_ROLES.SELLER]),
  }),
})
