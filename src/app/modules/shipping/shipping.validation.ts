import { z } from 'zod'

const addressSchema = z.object({
  name: z.string().trim().max(100).optional(),
  street1: z.string({ required_error: 'Street address is required.' }).trim().min(1).max(200),
  street2: z.string().trim().max(200).optional(),
  city: z.string({ required_error: 'City is required.' }).trim().min(1).max(100),
  state: z.string({ required_error: 'State is required.' }).trim().min(2).max(50),
  zip: z.string({ required_error: 'ZIP code is required.' }).trim().min(3).max(20),
  country: z.string().trim().default('US'),
  phone: z.string().trim().max(30).optional(),
})

const setShipFromZodSchema = z.object({
  body: addressSchema.extend({
    name: z.string({ required_error: 'Name is required.' }).trim().min(1).max(100),
  }),
})

const quoteRatesZodSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'productId is required.' }),
    toAddress: addressSchema,
  }),
})

const buyLabelZodSchema = z.object({
  body: z.object({
    /** e.g. "GroundAdvantage" or "Priority". Omit for the cheapest. */
    service: z.string().trim().max(50).optional(),
  }),
})

export const ShippingValidations = {
  setShipFromZodSchema,
  quoteRatesZodSchema,
  buyLabelZodSchema,
}
