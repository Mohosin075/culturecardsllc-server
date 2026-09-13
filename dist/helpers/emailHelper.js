"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailHelper = void 0;
const resend_1 = require("resend");
const config_1 = __importDefault(require("../config"));
const resend = config_1.default.email.resend_api_key
    ? new resend_1.Resend(config_1.default.email.resend_api_key)
    : null;
const sendEmail = async (values) => {
    var _a;
    const fromName = 'Aries';
    const fromEmail = config_1.default.email.from || 'no-reply@areisco.com';
    if (!resend) {
        console.error('❌ RESEND_API_KEY is not configured in environment variables.');
        return;
    }
    try {
        const resendFromEmail = fromEmail.includes('@gmail.com') ||
            fromEmail.includes('@yahoo.com') ||
            fromEmail.includes('@hotmail.com')
            ? 'onboarding@resend.dev'
            : fromEmail;
        let formattedFrom = `"${fromName}" <${resendFromEmail}>`;
        let response = await resend.emails.send({
            from: formattedFrom,
            to: values.to,
            subject: values.subject,
            html: values.html,
        });
        if (response.error && response.error.message.includes('domain is not verified')) {
            console.warn(`⚠️ Domain for ${fromEmail} is not verified on Resend yet. Retrying with onboarding@resend.dev for testing...`);
            formattedFrom = `"${fromName}" <onboarding@resend.dev>`;
            response = await resend.emails.send({
                from: formattedFrom,
                to: values.to,
                subject: values.subject,
                html: values.html,
            });
        }
        if (response.error) {
            console.error('❌ Resend email failed:', response.error.message);
        }
        else {
            console.log('✅ Mail sent successfully via Resend:', (_a = response.data) === null || _a === void 0 ? void 0 : _a.id);
        }
    }
    catch (error) {
        console.error('❌ Error sending email with Resend:', error);
    }
};
exports.emailHelper = {
    sendEmail,
};
