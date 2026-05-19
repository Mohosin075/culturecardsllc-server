# CultureCards LLC Server

Modern, scalable backend for a social/media platform built with Node.js, TypeScript, Express, MongoDB, and Socket.IO. Provides JWT auth, social login, presigned S3 uploads, notifications, payments, and more via modular architecture.

## Features

- Authentication and authorization with JWT, roles, refresh tokens
- Social auth via Google and Facebook
- User management and profile media uploads to AWS S3 (presigned)
- Real-time messaging and events via Socket.IO
- Notifications with scheduling, providers, and templated emails
- Payments and webhooks with Stripe
- Email via SMTP/Resend and SMS via Twilio
- Validation with Zod and centralized error handling
- Logging with Winston and daily rotate files

## Tech Stack

- Node.js, TypeScript, Express, Socket.IO
- MongoDB (Mongoose)
- Zod, Winston
- AWS S3 (`@aws-sdk/client-s3`, `sharp`)
- Passport (local, Google OAuth, Facebook)

## Requirements

- Node.js 18+ and npm/yarn
- MongoDB instance (local or cloud)
- Optional: AWS S3, SMTP/Resend, Twilio, Stripe, Firebase, Agora

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` in the project root. Minimal keys:

   ```env
   # Server
   PORT=3000
   DATABASE_URL=mongodb://localhost:27017/culturecardsllc-server
   NODE_ENV=development
   clientUrl=http://localhost:5173

   # JWT
   JWT_SECRET=replace_me
   JWT_EXPIRE_IN=1d
   JWT_REFRESH_SECRET=replace_me_refresh
   JWT_REFRESH_EXPIRES_IN=7d

   # AWS S3
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   AWS_BUCKET_NAME=culturecardsllc-bucket

   # Email
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_USER=user@example.com
   EMAIL_PASS=app_password
   EMAIL_FROM=CultureCards LLC <no-reply@culturecardsllc.com>
   RESEND_API_KEY=optional_resend_key

   # Twilio (optional)
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_PHONE_NUMBER=+1234567890

   # Stripe (optional)
   STRIPE_API_SECRET=sk_live_or_test
   WEBHOOK_SECRET=whsec_...
   SUCCESS_URL=https://culturecardsllc.example/success

   # OAuth (optional)
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
   FACEBOOK_APP_ID=...
   FACEBOOK_APP_SECRET=...
   FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/callback
   ```

3. Start in development:
   ```bash
   npm run start
   ```
4. Build and run in production:
   ```bash
   npm run build
   npm run start:prod
   ```

## Scripts

- `npm run start`: start dev server with ts-node-dev
- `npm run build`: compile TypeScript to `dist`
- `npm run start:prod`: run compiled server
- `npm run lint:check`: run ESLint
- `npm run lint:fix`: auto-fix ESLint issues
- `npm run prettier:check`: format JS/TS/JSON files
- `npm run prettier:fix`: format entire project

## Project Structure

- `src/app/modules` – feature modules (routes, controllers, services, models)
  - Auth: [`auth.route.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/auth/auth.route.ts)
  - Chat: [`chat.routes.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/chat/chat.routes.ts)
  - Message: [`message.routes.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/message/message.routes.ts)
  - Notification: [`notification.routes.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/notification/notification.routes.ts)
  - Payment: [`payment.route.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/payment/payment.route.ts)
  - Upload: [`upload.route.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/upload/upload.route.ts)
  - User: [`user.route.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/user/user.route.ts)
- Global config: [`config/index.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/config/index.ts)
- HTTP entrypoint: [`server.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/server.ts)
- Route registry: [`routes/index.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/routes/index.ts)
- Socket utilities: [`utils/socket.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/utils/socket.ts)
- S3 uploads: [`s3helper.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/helpers/image/s3helper.ts)

## Uploads (S3 Presigned)

- Endpoint: POST `/upload/presign` (requires auth)
- Request body: `{ filename, contentType, folder?: 'videos' | 'images' }`
- Response: `{ signedUrl, publicUrl, key }`
- Controller: [`upload.controller.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/upload/upload.controller.ts)
- Module docs: [`README.md`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/upload/README.md)

## Payments (Stripe)

- Stripe client config: [`stripe.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/config/stripe.ts)
- Webhook handling lives in the payment module

## Notifications

- Schedulers and templates under the notification module
- HTML templates: [`notification.templates.ts`](file:///d:/Mohosin/Mohosin/projects/culturecardsllc-server/src/app/modules/notification/notification.templates.ts)
