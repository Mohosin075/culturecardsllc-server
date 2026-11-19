"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
async function fixIndexes() {
    try {
        await mongoose_1.default.connect(config_1.default.database_url);
        console.log('Connected to MongoDB');
        const db = mongoose_1.default.connection.db;
        if (!db)
            throw new Error('DB connection failed');
        const collection = db.collection('partnerearnings');
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes.map(i => i.name));
        for (const idx of indexes) {
            if (idx.name && idx.name !== '_id_') {
                console.log(`Dropping index: ${idx.name}`);
                await collection.dropIndex(idx.name);
            }
        }
        console.log('Dropped old indexes successfully!');
        await mongoose_1.default.disconnect();
    }
    catch (err) {
        console.error('Error fixing indexes:', err);
    }
}
fixIndexes();
