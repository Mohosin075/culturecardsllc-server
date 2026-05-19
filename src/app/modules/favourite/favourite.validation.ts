import { z } from 'zod'
import { FavouriteType } from './favourite.interface'

const toggleFavouriteZodSchema = z.object({
  body: z
    .object({
      favouriteType: z.enum(
        Object.values(FavouriteType) as [string, ...string[]],
      ),
      service: z.string().optional(),
      provider: z.string().optional(),
    })
    .refine(
      data => {
        if (data.favouriteType === FavouriteType.SERVICE && !data.service)
          return false
        if (data.favouriteType === FavouriteType.PROVIDER && !data.provider)
          return false
        return true
      },
      {
        message:
          'Either service or provider ID must be provided based on favouriteType',
      },
    ),
})

export const FavouriteValidation = {
  toggleFavouriteZodSchema,
}
