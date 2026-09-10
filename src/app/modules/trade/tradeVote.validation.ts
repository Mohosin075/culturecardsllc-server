import { z } from 'zod'

const castVoteSchema = z.object({
  body: z.object({
    option: z.enum(['A', 'B'], {
      required_error: "Option is required and must be 'A' or 'B'",
    }),
  }),
})

export const TradeVoteValidations = {
  castVoteSchema,
}
