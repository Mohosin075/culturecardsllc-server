import nodemailer from 'nodemailer'
import config from '../config'
import { ISendEmail } from '../interfaces/email'

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: Number(config.email.port),
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
  // 👇 ignore self-signed cert
  // 👇 TODO : remove after complete
  tls: {
    rejectUnauthorized: false,
  },
})

const sendEmail = async (values: ISendEmail) => {
  try {
    const info = await transporter.sendMail({
      from: `"Photopya" ${config.email.from}`,
      to: values.to,
      subject: values.subject,
      html: values.html,
    })

    console.log('Mail send successfully', info.accepted)
  } catch (error) {
    console.log({ error })
    console.error('Email', error)
  }
}

export const emailHelper = {
  sendEmail,
}
