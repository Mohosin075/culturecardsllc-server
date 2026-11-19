"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const product_model_1 = require("../app/modules/product/product.model");
async function clearExistingInventory() {
    try {
        console.log('Connecting to database...');
        await mongoose_1.default.connect(config_1.default.database_url);
        console.log('🚀 Database connected successfully');
        const count = await product_model_1.Product.countDocuments();
        console.log(`Found ${count} products in database. Removing them from Trade Marketplace & Featured Collectibles...`);
        const result = await product_model_1.Product.deleteMany({});
        console.log(`✅ Successfully removed ${result.deletedCount} products from database!`);
        console.log('✨ Mock community voting trades were kept untouched.');
    }
    catch (error) {
        console.error('❌ Error clearing products:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log('Database disconnected.');
        process.exit(0);
    }
}
clearExistingInventory();
