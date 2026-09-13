import { Resend } from 'resend'
import { StatusCodes } from 'http-status-codes'
import config from '../../../config'
import ApiError from '../../../errors/ApiError'
import { EmailNotificationData } from './notification.interface'
import { EmailTemplates } from './notification.templates'

export class EmailProvider {
  private resend: Resend | null = null
  private static instance: EmailProvider

  private constructor() {
    if (config.email.resend_api_key) {
      this.resend = new Resend(config.email.resend_api_key)
    }
  }

  static getInstance(): EmailProvider {
    if (!EmailProvider.instance) {
      EmailProvider.instance = new EmailProvider()
    }
    return EmailProvider.instance
  }

  async sendEmail(data: EmailNotificationData): Promise<boolean> {
    try {
      const { subject, html } = EmailTemplates.getTemplate(
        data.template,
        data.data,
      )

      const fromName = 'Aries'
      const fromEmail = config.email.from || 'no-reply@areisco.com'

      if (!this.resend) {
        console.error('❌ RESEND_API_KEY is missing.')
        throw new ApiError(
          StatusCodes.SERVICE_UNAVAILABLE,
          'Email service is not configured',
        )
      }

      const resendFromEmail =
        fromEmail.includes('@gmail.com') ||
        fromEmail.includes('@yahoo.com') ||
        fromEmail.includes('@hotmail.com')
          ? 'onboarding@resend.dev'
          : fromEmail
      let resendFormattedFrom = `"${fromName}" <${resendFromEmail}>`

      const toAddresses = Array.isArray(data.to) ? data.to : [data.to]

      let response = await this.resend.emails.send({
        from: resendFormattedFrom,
        to: toAddresses,
        subject,
        html,
      })

      if (response.error && response.error.message.includes('domain is not verified')) {
        console.warn(
          `⚠️ Domain for ${fromEmail} is not verified on Resend yet. Retrying with onboarding@resend.dev for testing...`,
        )
        resendFormattedFrom = `"${fromName}" <onboarding@resend.dev>`
        response = await this.resend.emails.send({
          from: resendFormattedFrom,
          to: toAddresses,
          subject,
          html,
        })
      }

      if (response.error) {
        console.error('❌ Resend email failed:', response.error.message)
        throw new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          `Failed to send email via Resend: ${response.error.message}`,
        )
      }

      console.log(`📧 Email sent via Resend: ${response.data?.id}`)
      return true
    } catch (error: any) {
      console.error('❌ Email sending failed:', error.message)
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        `Failed to send email: ${error.message}`,
      )
    }
  }

  async sendBulkEmails(
    emails: EmailNotificationData[],
  ): Promise<{ success: number; failed: number }> {
    const results = {
      success: 0,
      failed: 0,
    }

    for (const emailData of emails) {
      try {
        await this.sendEmail(emailData)
        results.success++
      } catch (error) {
        console.error(`Failed to send email to: ${emailData.to}`)
        results.failed++
      }
    }

    console.log(
      `📧 Bulk email sending completed: ${results.success} succeeded, ${results.failed} failed`,
    )
    return results
  }

  async sendTemplateEmail(
    to: string | string[],
    template: string,
    templateData: Record<string, any>,
    subjectOverride?: string,
  ): Promise<boolean> {
    const data: EmailNotificationData = {
      to,
      subject: subjectOverride || '',
      template,
      data: templateData,
    }

    return this.sendEmail(data)
  }

  async sendWelcomeEmail(to: string, userName: string): Promise<boolean> {
    return this.sendTemplateEmail(to, 'welcome', {
      userName,
      actionUrl: `${config.clientUrl}/dashboard`,
      actionText: 'Go to Dashboard',
    })
  }

  async sendTicketConfirmation(
    to: string,
    eventTitle: string,
    ticketData: any,
  ): Promise<boolean> {
    return this.sendTemplateEmail(to, 'ticket-confirmation', {
      ...ticketData,
      eventTitle,
      actionUrl: `${config.clientUrl}/tickets/${ticketData.ticketId}`,
      actionText: 'View Ticket',
    })
  }

  async sendEventReminder(to: string, eventData: any): Promise<boolean> {
    return this.sendTemplateEmail(to, 'event-reminder', {
      ...eventData,
      actionUrl: `${config.clientUrl}/events/${eventData.eventId}`,
      actionText: 'View Event Details',
    })
  }

  async sendPasswordReset(
    to: string,
    resetCode: string,
    userName: string,
  ): Promise<boolean> {
    return this.sendTemplateEmail(to, 'password-reset', {
      userName,
      resetCode,
      expiryMinutes: 30,
      actionUrl: `${config.clientUrl}/reset-password?code=${resetCode}`,
      actionText: 'Reset Password',
    })
  }

  async sendAccountVerification(
    to: string,
    userName: string,
    verificationToken: string,
  ): Promise<boolean> {
    const verificationUrl = `${config.clientUrl}/verify-email?token=${verificationToken}`

    return this.sendTemplateEmail(to, 'account-verification', {
      userName,
      verificationUrl,
      actionUrl: verificationUrl,
      actionText: 'Verify Account',
    })
  }
}

export const emailProvider = EmailProvider.getInstance()
