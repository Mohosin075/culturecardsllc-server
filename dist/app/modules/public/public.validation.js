"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePublicZodSchema = exports.FaqValidations = exports.PublicValidation = void 0;
const zod_1 = require("zod");
const contactZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({
            required_error: 'Name is required',
        }),
        email: zod_1.z
            .string({
            required_error: 'Email is required',
        })
            .email('Invalid email format'),
        phone: zod_1.z.string({
            required_error: 'Phone number is required',
        }),
        country: zod_1.z.string({
            required_error: 'Country is required',
        }),
        message: zod_1.z.string({
            required_error: 'Message is required',
        }),
    }),
});
exports.PublicValidation = {
    create: zod_1.z.object({
        body: zod_1.z.object({
            content: zod_1.z.string(),
            type: zod_1.z.enum([
                'privacy-policy',
                'terms-and-condition',
                'contact',
                'about',
            ]),
        }),
    }),
    update: zod_1.z.object({
        body: zod_1.z.object({
            content: zod_1.z.string(),
            type: zod_1.z.enum([
                'privacy-policy',
                'terms-and-condition',
                'contact',
                'about',
            ]),
        }),
    }),
    contactZodSchema,
};
exports.FaqValidations = {
    create: zod_1.z.object({
        body: zod_1.z.object({
            question: zod_1.z.string(),
            answer: zod_1.z.string(),
        }),
    }),
    update: zod_1.z.object({
        body: zod_1.z.object({
            question: zod_1.z.string().optional(),
            answer: zod_1.z.string().optional(),
        }),
    }),
};
exports.updatePublicZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string(),
    }),
});
