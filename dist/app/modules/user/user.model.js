"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const bcrypt_1 = __importDefault(require("bcrypt"));
const user_1 = require("../../../enum/user");
// ------------------ USER SCHEMA ------------------
const UserSchema = new mongoose_1.Schema({
    name: { type: String, trim: true },
    fullName: { type: String, trim: true },
    email: { type: String, unique: true, lowercase: true, required: true },
    profile: { type: String, default: '/images/1767048629458-l94gk7.jpg' },
    phone: { type: String },
    description: { type: String },
    interest: { type: [String], enum: Object.values(user_1.InterestCategory) },
    status: {
        type: String,
        enum: Object.values(user_1.USER_STATUS),
        default: user_1.USER_STATUS.ACTIVE,
    },
    verified: { type: Boolean, default: false },
    address: {
        city: String,
        postalCode: String,
        country: String,
        permanentAddress: String,
        presentAddress: String,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number],
            default: [0, 0], // [longitude, latitude]
        },
    },
    subscribe: { type: Boolean, default: false },
    stripeCustomerId: { type: String },
    stripeConnectedAccountId: { type: String },
    isStripeConnected: { type: Boolean, default: false },
    subscriptionStatus: { type: String },
    subscriptionTier: { type: String },
    trialUsed: { type: Boolean, default: false },
    subscriptionExpiresAt: { type: Date },
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    password: { type: String, minlength: 6 },
    roles: {
        type: [String],
        enum: Object.values(user_1.USER_ROLES),
        default: [user_1.USER_ROLES.USER],
    },
    activeRole: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        default: user_1.USER_ROLES.USER,
    },
    appId: { type: String },
    provider: { type: String },
    deviceToken: { type: String },
    timezone: { type: String, default: 'UTC' },
    isOnboardingComplete: { type: Boolean, default: false },
    settings: {
        pushNotification: { type: Boolean, default: true },
        emailNotification: { type: Boolean, default: true },
        locationService: { type: Boolean, default: true },
        profileStatus: { type: String, default: 'public' },
    },
    authentication: {
        restrictionLeftAt: { type: Date, default: null },
        resetPassword: { type: Boolean, default: false },
        wrongLoginAttempts: { type: Number, default: 0 },
        passwordChangedAt: { type: Date },
        oneTimeCode: { type: String },
        latestRequestAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
        requestCount: { type: Number, default: 0 },
        authType: { type: String, enum: ['createAccount', 'resetPassword'] },
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// ------------------ INDEXES ------------------
UserSchema.index({ location: '2dsphere' }); // Geo queries support
// ------------------ PRE HOOKS ------------------
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    this.password = await bcrypt_1.default.hash(this.password, 10);
    next();
});
// ------------------ STATIC METHODS ------------------
UserSchema.statics.isPasswordMatched = async function (givenPassword, savedPassword) {
    return bcrypt_1.default.compare(givenPassword, savedPassword);
};
// ------------------ MODEL ------------------
exports.User = (0, mongoose_1.model)('User', UserSchema);
