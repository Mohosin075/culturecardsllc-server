"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplates = void 0;
const notification_constant_1 = require("./notification.constant");
class EmailTemplates {
    static getTemplate(templateName, data) {
        const template = this.templates[templateName];
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        let html = this.baseStyles;
        html += `<div class="container">`;
        html += this.header(template.getTitle(data));
        html += `<div class="content">`;
        html += template.getBody(data);
        if (data.actionUrl && data.actionText) {
            html += `<div style="text-align: center; margin-top: 30px;">
                <a href="${data.actionUrl}" class="button">${data.actionText}</a>
              </div>`;
        }
        html += `</div>`;
        html += this.footer;
        html += `</div>`;
        return {
            subject: template.getSubject(data),
            html: this.replacePlaceholders(html, data),
        };
    }
    static replacePlaceholders(html, data) {
        return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }
}
exports.EmailTemplates = EmailTemplates;
EmailTemplates.baseStyles = `
    <style>
      * { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; }
      body { margin: 0; padding: 0; background-color: #f7f7f7; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
      .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
      .footer { padding: 20px; text-align: center; color: #666666; font-size: 12px; border-top: 1px solid #eeeeee; }
      .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
      .event-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
      .info-label { font-weight: 600; color: #555; }
      .info-value { color: #333; }
      .ticket-qr { text-align: center; margin: 20px 0; }
      .qr-code { max-width: 200px; height: auto; }
    </style>
  `;
EmailTemplates.header = (title) => `
    <div class="header">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">${title}</h1>
    </div>
  `;
EmailTemplates.footer = `
    <div class="footer">
      <p>© ${new Date().getFullYear()} Photopya. All rights reserved.</p>
      <p>This email was sent by Photopya. If you have any questions, contact us at support@Photopya.com</p>
      <p>
        <a href="{{unsubscribeLink}}" style="color: #667eea; text-decoration: none;">Unsubscribe</a> | 
        <a href="{{privacyLink}}" style="color: #667eea; text-decoration: none;">Privacy Policy</a> | 
        <a href="{{termsLink}}" style="color: #667eea; text-decoration: none;">Terms of Service</a>
      </p>
    </div>
  `;
EmailTemplates.templates = {
    // Welcome Email
    [notification_constant_1.NOTIFICATION_TEMPLATES.WELCOME]: {
        getTitle: (data) => `Welcome to Photopya, ${data.userName}!`,
        getSubject: (data) => `Welcome to Photopya!`,
        getBody: (data) => `
        <h2>Welcome aboard, ${data.userName}!</h2>
        <p>We're excited to have you join our community of event enthusiasts. Here's what you can do:</p>
        <ul>
          <li>Discover amazing events in your area</li>
          <li>Create and manage your own events</li>
          <li>Connect with like-minded people</li>
          <li>Get personalized event recommendations</li>
        </ul>
        <p>Start exploring now and find events that match your interests!</p>
      `,
    },
    // Payment Success
    [notification_constant_1.NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS]: {
        getTitle: (data) => `Payment Successful!`,
        getSubject: (data) => `Payment Successful - ${data.eventTitle}`,
        getBody: (data) => `
        <h2>✅ Payment Successful</h2>
        <p>Your payment for <strong>${data.eventTitle}</strong> has been processed successfully.</p>
        
        <div class="event-details">
          <div class="info-row">
            <span class="info-label">Transaction ID:</span>
            <span class="info-value">${data.transactionId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Amount Paid:</span>
            <span class="info-value">${data.amount} ${data.currency}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Method:</span>
            <span class="info-value">${data.paymentMethod}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">${data.paymentDate}</span>
          </div>
        </div>

        <p>Your tickets have been confirmed and sent to your email. Check your inbox for the ticket confirmation email.</p>
        
        <p><strong>Need help?</strong></p>
        <p>If you have any questions about your purchase, please contact our support team.</p>
      `,
    },
    // Password Reset
    [notification_constant_1.NOTIFICATION_TEMPLATES.PASSWORD_RESET]: {
        getTitle: (data) => `Reset Your Password`,
        getSubject: (data) => `Password Reset Request`,
        getBody: (data) => `
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password for your EventHub account.</p>
        
        <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="margin: 0;"><strong>Reset Code:</strong></p>
          <h1 style="color: #667eea; font-size: 32px; letter-spacing: 5px; margin: 10px 0;">${data.resetCode}</h1>
          <p style="color: #666; font-size: 14px;">This code will expire in ${data.expiryMinutes} minutes</p>
        </div>

        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Go to the password reset page</li>
          <li>Enter the reset code above</li>
          <li>Create your new password</li>
        </ol>

        <p><strong>Security Tips:</strong></p>
        <ul>
          <li>Never share your password or reset code with anyone</li>
          <li>Create a strong password with letters, numbers, and symbols</li>
          <li>Use different passwords for different accounts</li>
        </ul>

        <p>If you didn't request this password reset, please ignore this email or contact support if you're concerned.</p>
      `,
    },
    // Account Verification
    [notification_constant_1.NOTIFICATION_TEMPLATES.ACCOUNT_VERIFICATION]: {
        getTitle: (data) => `Verify Your Account`,
        getSubject: (data) => `Verify Your EventHub Account`,
        getBody: (data) => `
        <h2>Verify Your Email Address</h2>
        <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <p>Click the button below to verify your email:</p>
          <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
        </div>

        <p style="font-size: 14px; color: #666; text-align: center;">
          Or copy and paste this link in your browser:<br/>
          <span style="color: #667eea; word-break: break-all;">${data.verificationUrl}</span>
        </p>

        <p><strong>Why verify?</strong></p>
        <ul>
          <li>Secure your account</li>
          <li>Receive important event notifications</li>
          <li>Access all features of Photopya</li>
          <li>Get personalized event recommendations</li>
        </ul>

        <p>This verification link will expire in 24 hours.</p>
      `,
    },
};
