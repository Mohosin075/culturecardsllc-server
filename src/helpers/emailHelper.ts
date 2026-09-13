import { Resend } from 'resend'
import config from '../config'
import { ISendEmail } from '../interfaces/email'

const resend = config.email.resend_api_key
  ? new Resend(config.email.resend_api_key)
  : null

const sendEmail = async (values: ISendEmail) => {
  const fromName = 'Aries'
  const fromEmail = config.email.from || 'no-reply@areisco.com'

  if (!resend) {
    console.error('❌ RESEND_API_KEY is not configured in environment variables.')
    return
  }

  try {
    const resendFromEmail =
      fromEmail.includes('@gmail.com') ||
      fromEmail.includes('@yahoo.com') ||
      fromEmail.includes('@hotmail.com')
        ? 'onboarding@resend.dev'
        : fromEmail

    let formattedFrom = `"${fromName}" <${resendFromEmail}>`

    let response = await resend.emails.send({
      from: formattedFrom,
      to: values.to,
      subject: values.subject,
      html: values.html,
    })

    if (response.error && response.error.message.includes('domain is not verified')) {
      console.warn(
        `⚠️ Domain for ${fromEmail} is not verified on Resend yet. Retrying with onboarding@resend.dev for testing...`,
      )
      formattedFrom = `"${fromName}" <onboarding@resend.dev>`
      response = await resend.emails.send({
        from: formattedFrom,
        to: values.to,
        subject: values.subject,
        html: values.html,
      })
    }

    if (response.error) {
      console.error('❌ Resend email failed:', response.error.message)
    } else {
      console.log('✅ Mail sent successfully via Resend:', response.data?.id)
    }
  } catch (error) {
    console.error('❌ Error sending email with Resend:', error)
  }
}

export const emailHelper = {
  sendEmail,
}
