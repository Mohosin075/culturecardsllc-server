"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSetEqual = exports.supportSearchableFields = exports.supportFilterables = void 0;
// Filterable fields for Support
exports.supportFilterables = ['subject', 'message'];
// Searchable fields for Support
exports.supportSearchableFields = ['subject', 'message'];
// Helper function for set comparison
const isSetEqual = (setA, setB) => {
    if (setA.size !== setB.size)
        return false;
    for (const item of setA) {
        if (!setB.has(item))
            return false;
    }
    return true;
};
exports.isSetEqual = isSetEqual;
