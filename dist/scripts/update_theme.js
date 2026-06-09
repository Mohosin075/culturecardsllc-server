"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const category_model_1 = require("../app/modules/category/category.model");
async function updateTheme() {
    try {
        // Connect to database
        await mongoose_1.default.connect(config_1.default.database_url);
        console.log('🚀 Database connected successfully');
        const oldTheme = 'EDITING & POST-PRODUCTION';
        const newTheme = 'EDITING AND POST-PRODUCTION';
        // 1. Get categories with the old theme
        const categories = await category_model_1.Category.find({ theme: oldTheme });
        console.log(`🔍 Found ${categories.length} categories with theme: "${oldTheme}"`);
        if (categories.length > 0) {
            console.log('📋 Categories to be updated:');
            categories.forEach(cat => console.log(`   - ${cat.name} (ID: ${cat._id})`));
            // 2. Update them
            const result = await category_model_1.Category.updateMany({ theme: oldTheme }, { $set: { theme: newTheme } });
            console.log(`✅ Update result: ${result.modifiedCount} documents updated.`);
            console.log(`🎉 Successfully updated to: "${newTheme}"`);
        }
        else {
            console.log('ℹ️ No categories found with that theme.');
        }
    }
    catch (error) {
        console.error('❌ Error during update:', error);
    }
    finally {
        await mongoose_1.default.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}
updateTheme();
