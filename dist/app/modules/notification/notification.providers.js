"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailProvider = exports.EmailProvider = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const notification_templates_1 = require("./notification.templates");
class EmailProvider {
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            host: config_1.default.email.host,
            port: config_1.default.email.port,
            secure: false, // false for TLS, true for SSL
            auth: {
                user: config_1.default.email.user,
                pass: config_1.default.email.pass,
            },
            // For development, bypass SSL verification
            tls: {
                rejectUnauthorized: false,
            },
            // Connection settings
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
        });
        // Initialize asynchronously
        // this.initialize()
    }
    static getInstance() {
        if (!EmailProvider.instance) {
            EmailProvider.instance = new EmailProvider();
        }
        return EmailProvider.instance;
    }
    async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('✅ Email server connection verified');
        }
        catch (error) {
            console.error('❌ Email server connection failed:', error.message);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.SERVICE_UNAVAILABLE, 'Email service is currently unavailable');
        }
    }
    async sendEmail(data) {
        try {
            const { subject, html } = notification_templates_1.EmailTemplates.getTemplate(data.template, data.data);
            const mailOptions = {
                from: `Photopya <${config_1.default.email.from}>`,
                to: Array.isArray(data.to) ? data.to.join(',') : data.to,
                subject,
                html,
                attachments: data.attachments,
            };
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email sent: ${info.messageId}`);
            console.log(`   To: ${mailOptions.to}`);
            console.log(`   Subject: ${subject}`);
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
