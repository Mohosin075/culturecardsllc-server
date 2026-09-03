import cors from 'cors'
import express, { Request, Response } from 'express'
import { Types } from 'mongoose'
import { StatusCodes } from 'http-status-codes'
import path from 'path'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import passport from './app/modules/auth/passport.auth/config/passport'
import router from './routes'
import globalErrorHandler from './app/middleware/globalErrorHandler'
import config from './config'
import webhookApp from './webhook'
import sendResponse from './shared/sendResponse'
import morgan from 'morgan'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import swaggerDocs from './utils/swagger'
import Product from './app/modules/product/product.model'
import { User } from './app/modules/user/user.model'

const app = express()

// ✅ CORS MUST be first — before helmet, session, passport, everything
// This ensures preflight OPTIONS requests get correct headers
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = config.cors_origins.length > 0
        ? config.cors_origins
        : ['http://localhost:3000']
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS: Origin ${origin} not allowed`), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Accept'],
  }),
)
// Handle preflight requests for all routes
app.options('*', cors())

// Security headers
app.use(helmet())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
})
if (config.node_env !== 'development') {
  app.use('/api', limiter)
}

// ⚠️ CRITICAL: Webhook MUST be before body parsers to receive raw body
app.use(webhookApp)

// -------------------- Middleware --------------------
// Body parsers must come after webhook
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Session must come before passport
app.use(
  session({
    secret: config.jwt.jwt_secret || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.node_env === 'production', // true if using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
)

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

// CORS is already applied at the top of the middleware stack

// Cookie parser
app.use(cookieParser())

// Logging
app.use(morgan('dev'))

// -------------------- Static Files --------------------
// Serve uploads folder statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
app.use(express.static(path.join(process.cwd(), 'uploads')))

// -------------------- Deep Linking Verification (.well-known) --------------------
app.get('/.well-known/assetlinks.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: config.deepLink.androidPackageName,
        sha256_cert_fingerprints: config.deepLink.androidSha256Fingerprints,
      },
    },
  ])
})

app.get('/.well-known/apple-app-site-association', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: config.deepLink.iosAppId,
          paths: ['/trade/*', '/profile/*'],
        },
      ],
    },
  })
})

// -------------------- Open Graph (OG) & Deep Link Preview Pages --------------------
app.get('/trade/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params
    const product = Types.ObjectId.isValid(productId)
      ? await Product.findById(productId).lean()
      : null

    const host = req.get('host') || 'culturecards.app'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const title = product
      ? `${product.title} - $${(product.buyNowPrice || product.estValue || 0).toFixed(2)}`
      : 'Culture Cards Trade'
    const description =
      product?.description || 'Check out this verified trading card on Culture Cards LLC.'

    let rawImage = product?.images?.[0] || '/uploads/default-card.png'
    const image = rawImage.startsWith('http')
      ? rawImage
      : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
    const pageUrl = `${baseUrl}/trade/${productId}`
    const deepLink = `culturecards://trade/${productId}`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #0f172a; color: #fff; }
    .card { max-width: 400px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    img { max-width: 100%; border-radius: 12px; margin-bottom: 16px; object-fit: cover; max-height: 300px; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: #fff; font-weight: bold; text-decoration: none; border-radius: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <img src="${image}" alt="${title}" />
    <h2>${title}</h2>
    <p>${description}</p>
    <a href="${deepLink}" class="btn">Open in Culture Cards App</a>
  </div>
  <script>
    window.location.href = "${deepLink}";
  </script>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send('Error rendering trade preview')
  }
})

app.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const user = Types.ObjectId.isValid(userId)
      ? await User.findById(userId).lean()
      : null

    const host = req.get('host') || 'culturecards.app'
    const protocol = req.protocol || 'https'
    const baseUrl = `${protocol}://${host}`

    const title = user
      ? `${user.name} (@${user.username || 'trader'}) - Culture Cards`
      : 'Trader Profile - Culture Cards'
    const description =
      (user as any)?.description ||
      (user as any)?.bio ||
      `Check out ${user?.name || 'this seller'}'s verified trading card collection on Culture Cards LLC.`

    let rawImage = user?.profile || '/uploads/default-avatar.png'
    const image = rawImage.startsWith('http')
      ? rawImage
      : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
    const pageUrl = `${baseUrl}/profile/${userId}`
    const deepLink = `culturecards://profile/${userId}`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #0f172a; color: #fff; }
    .card { max-width: 400px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    img { width: 120px; height: 120px; border-radius: 60px; margin-bottom: 16px; object-fit: cover; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: #fff; font-weight: bold; text-decoration: none; border-radius: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <img src="${image}" alt="${title}" />
    <h2>${user?.name || 'Trader Profile'}</h2>
    <p>${description}</p>
    <a href="${deepLink}" class="btn">Open Profile in App</a>
  </div>
  <script>
    window.location.href = "${deepLink}";
  </script>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(html)
  } catch (error) {
    res.status(500).send('Error rendering profile preview')
  }
})

// -------------------- API Routes --------------------
app.use('/api/v1', router)

// Swagger Documentation
swaggerDocs(app, Number(config.port))

// -------------------- Privacy Policy --------------------
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy-policy.html'))
})

router.get('/status', (req: Request, res: Response) => {
  try {
    const healthCheck = {
      success: true,
      message: 'Server is running smoothly',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: config.node_env,
    }

    res.status(StatusCodes.OK).json(healthCheck)
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Server is experiencing issues',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// -------------------- Root Response --------------------
app.get('/', (req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Welcome to the Aries API',
    data: {
      timestamp: new Date().toISOString(),
      projectName: 'Aries',
      version: '1.0.0',
    },
  })
})

// -------------------- Global Error Handler --------------------
app.use(globalErrorHandler)

// -------------------- 404 Handler --------------------
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'The requested resource was not found on this server.',
    errorMessages: [
      {
        path: req.originalUrl,
        message: 'Endpoint does not exist',
      },
    ],
    timestamp: new Date().toISOString(),
  })
})

export default app
