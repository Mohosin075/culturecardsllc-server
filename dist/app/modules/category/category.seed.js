"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAreisCategories = exports.AREIS_CATEGORIES = void 0;
const colors_1 = __importDefault(require("colors"));
const category_model_1 = require("./category.model");
/**
 * AREIS marketplace categories (client spec). The description holds the
 * subcategory text shown under each category in the app.
 */
exports.AREIS_CATEGORIES = [
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
    { name: 'Other', description: 'Miscellaneous Items' },
];
/**
 * Idempotent: creates any of the 16 categories that are missing and keeps
 * their description in sync. Migrates legacy "Other / Not Listed" to "Other"
 * in-place so existing product ObjectId references remain intact.
 */
const seedAreisCategories = async () => {
    const legacyOther = await category_model_1.Category.findOne({ name: 'Other / Not Listed', parent: null });
    const existingOther = await category_model_1.Category.findOne({ name: 'Other', parent: null });
    if (legacyOther && !existingOther) {
        legacyOther.name = 'Other';
        legacyOther.description = 'Miscellaneous Items';
        await legacyOther.save();
        console.log(colors_1.default.green('🗂️  Renamed legacy "Other / Not Listed" category to "Other".'));
    }
    let created = 0;
    for (const cat of exports.AREIS_CATEGORIES) {
        const existing = await category_model_1.Category.findOne({ name: cat.name, parent: null });
        if (!existing) {
            await category_model_1.Category.create({ ...cat, type: 'category', isActive: true });
            created++;
        }
        else if (existing.description !== cat.description) {
            existing.description = cat.description;
            await existing.save();
        }
    }
    if (created) {
        console.log(colors_1.default.green(`🗂️  Seeded ${created} AREIS marketplace categories.`));
    }
};
exports.seedAreisCategories = seedAreisCategories;
