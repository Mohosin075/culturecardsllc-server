"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailProvider = exports.EmailProvider = void 0;
const resend_1 = require("resend");
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const notification_templates_1 = require("./notification.templates");
class EmailProvider {
    constructor() {
        this.resend = null;
        if (config_1.default.email.resend_api_key) {
            this.resend = new resend_1.Resend(config_1.default.email.resend_api_key);
        }
    }
    static getInstance() {
        if (!EmailProvider.instance) {
            EmailProvider.instance = new EmailProvider();
        }
        return EmailProvider.instance;
    }
    async sendEmail(data) {
        var _a;
        try {
            const { subject, html } = notification_templates_1.EmailTemplates.getTemplate(data.template, data.data);
            const fromName = 'Aries';
            const fromEmail = config_1.default.email.from || 'no-reply@areisco.com';
            if (!this.resend) {
                console.error('❌ RESEND_API_KEY is missing.');
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.SERVICE_UNAVAILABLE, 'Email service is not configured');
            }
            const resendFromEmail = fromEmail.includes('@gmail.com') ||
                fromEmail.includes('@yahoo.com') ||
                fromEmail.includes('@hotmail.com')
                ? 'onboarding@resend.dev'
                : fromEmail;
            let resendFormattedFrom = `"${fromName}" <${resendFromEmail}>`;
            const toAddresses = Array.isArray(data.to) ? data.to : [data.to];
            let response = await this.resend.emails.send({
                from: resendFormattedFrom,
                to: toAddresses,
                subject,
                html,
            });
            if (response.error && response.error.message.includes('domain is not verified')) {
                console.warn(`⚠️ Domain for ${fromEmail} is not verified on Resend yet. Retrying with onboarding@resend.dev for testing...`);
                resendFormattedFrom = `"${fromName}" <onboarding@resend.dev>`;
                response = await this.resend.emails.send({
                    from: resendFormattedFrom,
                    to: toAddresses,
                    subject,
                    html,
                });
            }
            if (response.error) {
                console.error('❌ Resend email failed:', response.error.message);
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Failed to send email via Resend: ${response.error.message}`);
            }
            console.log(`📧 Email sent via Resend: ${(_a = response.data) === null || _a === void 0 ? void 0 : _a.id}`);
            return true;
        }
        catch (error) {
            console.error('❌ Email sending failed:', error.message);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Failed to send email: ${error.message}`);
        }
    }
    async sendBulkEmails(emails) {
        const results = {
            success: 0,
            failed: 0,
        };
        for (const emailData of emails) {
            try {
                await this.sendEmail(emailData);
                results.success++;
            }
            catch (error) {
                console.error(`Failed to send email to: ${emailData.to}`);
                results.failed++;
            }
        }
        console.log(`📧 Bulk email sending completed: ${results.success} succeeded, ${results.failed} failed`);
        return results;
    }
    async sendTemplateEmail(to, template, templateData, subjectOverride) {
        const data = {
            to,
            subject: subjectOverride || '',
            template,
            data: templateData,
        };
        return this.sendEmail(data);
    }
    async sendWelcomeEmail(to, userName) {
        return this.sendTemplateEmail(to, 'welcome', {
            userName,
            actionUrl: `${config_1.default.clientUrl}/dashboard`,
            actionText: 'Go to Dashboard',
        });
    }
    async sendTicketConfirmation(to, eventTitle, ticketData) {
        return this.sendTemplateEmail(to, 'ticket-confirmation', {
            ...ticketData,
            eventTitle,
            actionUrl: `${config_1.default.clientUrl}/tickets/${ticketData.ticketId}`,
            actionText: 'View Ticket',
        });
    }
    async sendEventReminder(to, eventData) {
        return this.sendTemplateEmail(to, 'event-reminder', {
            ...eventData,
            actionUrl: `${config_1.default.clientUrl}/events/${eventData.eventId}`,
            actionText: 'View Event Details',
        });
    }
    async sendPasswordReset(to, resetCode, userName) {
        return this.sendTemplateEmail(to, 'password-reset', {
            userName,
            resetCode,
            expiryMinutes: 30,
            actionUrl: `${config_1.default.clientUrl}/reset-password?code=${resetCode}`,
            actionText: 'Reset Password',
        });
    }
    async sendAccountVerification(to, userName, verificationToken) {
        const verificationUrl = `${config_1.default.clientUrl}/verify-email?token=${verificationToken}`;
        return this.sendTemplateEmail(to, 'account-verification', {
            userName,
            verificationUrl,
            actionUrl: verificationUrl,
            actionText: 'Verify Account',
        });
    }
}
exports.EmailProvider = EmailProvider;
exports.emailProvider = EmailProvider.getInstance();
