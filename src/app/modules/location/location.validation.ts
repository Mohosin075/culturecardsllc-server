import { z } from 'zod'

const searchSuggestionsSchema = z.object({
  query: z.object({
    q: z.string({
      required_error: 'Search query (q) is required',
    }),
  }),
})

const geocodeAddressSchema = z.object({
  query: z.object({
    address: z.string({
      required_error: 'Address is required',
    }),
  }),
})

export const LocationValidation = {
  searchSuggestionsSchema,
  geocodeAddressSchema,
}
