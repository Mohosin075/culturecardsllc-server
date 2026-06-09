"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidations = void 0;
const libphonenumber_js_1 = require("libphonenumber-js");
const user_1 = require("../../../enum/user");
const zod_1 = require("zod");
const verifyEmailOrPhoneOtpZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\S+@\S+\.\S+$/.test(value), {
            message: 'Invalid email format',
        }),
        phone: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\+?[1-9]\d{1,14}$/.test(value), {
            message: 'Invalid phone number format',
        }),
        oneTimeCode: zod_1.z.string().min(1, { message: 'OTP is required' }),
    }),
});
const forgetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\S+@\S+\.\S+$/.test(value), {
            message: 'Invalid email format',
        }),
        phone: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\+?[1-9]\d{1,14}$/.test(value), {
            message: 'Invalid phone number format',
        }),
    }),
});
const resetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        newPassword: zod_1.z.string().min(8, { message: 'Password is required' }),
        confirmPassword: zod_1.z
            .string()
            .min(8, { message: 'Confirm Password is required' }),
    }),
});
const loginZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\S+@\S+\.\S+$/.test(value), {
            message: 'Invalid email format',
        }),
        phone: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\+?[1-9]\d{1,14}$/.test(value), {
            message: 'Invalid phone number format',
        }),
        deviceToken: zod_1.z.string().min(1).optional(),
        rememberMe: zod_1.z.boolean().optional(),
        password: zod_1.z.string().min(6, { message: 'Password is required' }),
    }),
});
const verifyAccountZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\S+@\S+\.\S+$/.test(value), {
            message: 'Invalid email format',
        }),
        phone: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\+?[1-9]\d{1,14}$/.test(value), {
            message: 'Invalid phone number format',
        }),
        oneTimeCode: zod_1.z.string().min(1, { message: 'OTP is required' }),
    }),
});
const resendOtpZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\S+@\S+\.\S+$/.test(value), {
            message: 'Invalid email format',
        }),
        phone: zod_1.z
            .string()
            .optional()
            .refine(value => !value || /^\+?[1-9]\d{1,14}$/.test(value), {
            message: 'Invalid phone number format',
        }),
        authType: zod_1.z.enum(['resetPassword', 'createAccount']).optional(),
    }),
});
const changePasswordZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        currentPassword: zod_1.z.string({
            required_error: 'Current password is required',
        }),
        newPassword: zod_1.z
            .string({
            required_error: 'New password is required',
        })
            .min(8, 'Password must be at least 8 characters'),
        confirmPassword: zod_1.z.string({
            required_error: 'Confirm password is required',
        }),
    })
        .refine(data => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    }),
});
const deleteAccount = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string({
            required_error: 'Password is required',
        }),
    }),
});
const addressSchema = zod_1.z.object({
    city: zod_1.z.string().optional(),
    permanentAddress: zod_1.z.string().optional(),
    presentAddress: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
});
const createUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }).email().optional(),
        password: zod_1.z.string({ required_error: 'Password is required' }).min(6),
        name: zod_1.z.string({ required_error: 'Name is required' }).optional(),
        interest: zod_1.z
            .array(zod_1.z.enum(Object.values(user_1.InterestCategory)))
            .optional(),
        phone: zod_1.z
            .string()
            .refine(val => {
            var _a;
            const p = (0, libphonenumber_js_1.parsePhoneNumberFromString)(val);
            return (_a = p === null || p === void 0 ? void 0 : p.isValid()) !== null && _a !== void 0 ? _a : false;
        }, { message: 'Invalid phone number' })
            .optional(),
        address: addressSchema.optional(),
        role: zod_1.z.enum([user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL]).optional(),
    }),
});
const socialLoginZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        appId: zod_1.z.string({ required_error: 'App ID is required' }),
        deviceToken: zod_1.z.string({ required_error: 'Device token is required' }),
    }),
});
exports.AuthValidations = {
    verifyEmailOrPhoneOtpZodSchema,
    forgetPasswordZodSchema,
    resetPasswordZodSchema,
    loginZodSchema,
    verifyAccountZodSchema,
    resendOtpZodSchema,
    changePasswordZodSchema,
    createUserZodSchema,
    deleteAccount,
    socialLoginZodSchema,
};
