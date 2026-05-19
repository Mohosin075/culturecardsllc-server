import dotenv from 'dotenv'
import path from 'path'
import { z } from 'zod'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const envVarsSchema = z.object({
  IP_ADDRESS: z.string().optional(),
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL is required' }),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('5000'),
  BCRYPT_SALT_ROUNDS: z.string().default('12'),
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' }),
  JWT_EXPIRE_IN: z.string().default('1d'),
  JWT_REFRESH_SECRET: z.string({
    required_error: 'JWT_REFRESH_SECRET is required',
  }),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  STRIPE_API_SECRET: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  SUPER_ADMIN_NAME: z.string().optional(),
  SUPER_ADMIN_EMAIL: z.string().optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
})

const envVars = envVarsSchema.parse(process.env)

export default {
  ip_address: envVars.IP_ADDRESS,
  database_url: envVars.DATABASE_URL,
  node_env: envVars.NODE_ENV,
  clientUrl: process.env.clientUrl,
  port: envVars.PORT,
  bcrypt_salt_rounds: envVars.BCRYPT_SALT_ROUNDS,
  firebase_service_account_base64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
  server_map_api_key: process.env.SERVER_MAP_API_KEY,
  google: {
    client_id: envVars.GOOGLE_CLIENT_ID,
    client_secret: envVars.GOOGLE_CLIENT_SECRET,
    callback_url: envVars.GOOGLE_CALLBACK_URL,
  },
  facebook: {
    app_id: process.env.FACEBOOK_APP_ID,
    app_secret: process.env.FACEBOOK_APP_SECRET,
    callback_url: process.env.FACEBOOK_CALLBACK_URL,
  },
  instagram: {
    client_id: process.env.INSTAGRAM_CLIENT_ID,
    client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
    callback_url: process.env.INSTAGRAM_CALLBACK_URL,
  },
  tikok: {
    client_id: process.env.TIKTOK_CLIENT_ID,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    callback_url: process.env.TIKTOK_CALLBACK_URL,
  },
  aws: {
    access_key_id: process.env.AWS_ACCESS_KEY_ID,
    secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucket_name: process.env.AWS_BUCKET_NAME,
  },
  stripe: {
    stripeSecretKey: envVars.STRIPE_API_SECRET,
    webhookSecret: envVars.WEBHOOK_SECRET,
    paymentSuccess: process.env.SUCCESS_URL,
  },
  agora: {
    app_id: process.env.AGORA_APP_ID,
    app_certificate: process.env.AGORA_APP_CERTIFICATE,
    web_hook_secret: process.env.AGORA_WEB_HOOK_SECRET,
  },
  jwt: {
    jwt_secret: envVars.JWT_SECRET,
    jwt_expire_in: envVars.JWT_EXPIRE_IN,
    jwt_refresh_secret: envVars.JWT_REFRESH_SECRET,
    jwt_refresh_expire_in: envVars.JWT_REFRESH_EXPIRES_IN,
    jwt_refresh_expire_long: process.env.JWT_REFRESH_EXPIRE_LONG,
    temp_jwt_secret: process.env.TEMP_JWT_SECRET,
    temp_jwt_expire_in: process.env.TEMP_JWT_EXPIRE_IN,
  },
  application_fee: process.env.APPLICATION_FEE,
  instant_transfer_fee: process.env.INSTANT_TRANSFER_FEE,
  openAi_api_key: process.env.OPENAI_API_KEY,
  email: {
    from: process.env.EMAIL_FROM,
    user: envVars.EMAIL_USER,
    port: process.env.EMAIL_PORT,
    host: process.env.EMAIL_HOST,
    pass: envVars.EMAIL_PASS,
    resend_api_key: process.env.RESEND_API_KEY,
  },
  twilio: {
    account_sid: process.env.TWILIO_ACCOUNT_SID,
    auth_token: process.env.TWILIO_AUTH_TOKEN,
    phone_number: process.env.TWILIO_PHONE_NUMBER,
  },
  cloudinary: {
    cloudinary_name: process.env.CLOUDINARY_NAME,
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
    cloudinary_secret: process.env.CLOUDINARY_SECRET,
  },
  super_admin: {
    name: envVars.SUPER_ADMIN_NAME,
    email: envVars.SUPER_ADMIN_EMAIL,
    password: envVars.SUPER_ADMIN_PASSWORD,
  },
  cors_origins:
    envVars.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [],
}
