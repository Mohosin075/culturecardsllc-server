import colors from 'colors'
import { Category } from './category.model'

/**
 * AREIS marketplace categories (client spec). The description holds the
 * subcategory text shown under each category in the app.
 */
export const AREIS_CATEGORIES: { name: string; description: string }[] = [
  { name: 'Trading Cards & TCG', description: 'Sports Cards, Pokémon, MTG' },
  { name: 'Sports Memorabilia', description: 'Jerseys, Autographs, Memorabilia' },
  { name: 'Toys & Collectibles', description: 'Action Figures, LEGO, Die-Cast, Plush' },
  { name: 'Sneakers & Streetwear', description: 'Sneakers, Apparel, Streetwear' },
  { name: 'Fashion & Apparel', description: 'Designer Bags, Clothing, More' },
  { name: 'Watches & Luxury', description: 'Watches, Luxury Items' },
  { name: 'Jewelry & Accessories', description: 'Chains, Rings, Accessories' },
  { name: 'Electronics & Tech', description: 'Phones, Tablets, Tech' },
  { name: 'Coins & Currency', description: 'Coins, Currency, Items' },
  { name: 'Comics, Anime & Manga', description: 'Comics, Manga, Graphic Novels' },
  { name: 'Video Games', description: 'Consoles, Retro Games' },
  { name: 'Vintage & Antiques', description: 'Vintage Collectibles, Antiques' },
  { name: 'Home & Lifestyle', description: 'Decor, Lifestyle, More' },
  { name: 'Beauty & Personal Care', description: 'Skincare, Makeup, Fragrance' },
  { name: 'Books, Music & Media', description: 'Books, Movies, Music, More' },
  { name: 'Other / Not Listed', description: 'Miscellaneous Items' },
]

/**
 * Idempotent: creates any of the 16 categories that are missing and keeps
 * their description in sync. Never deletes or edits other categories.
 */
export const seedAreisCategories = async () => {
  let created = 0
  for (const cat of AREIS_CATEGORIES) {
    const existing = await Category.findOne({ name: cat.name, parent: null })
    if (!existing) {
      await Category.create({ ...cat, type: 'category', isActive: true })
      created++
    } else if (existing.description !== cat.description) {
      existing.description = cat.description
      await existing.save()
    }
  }
  if (created) {
    console.log(colors.green(`🗂️  Seeded ${created} AREIS marketplace categories.`))
  }
}
