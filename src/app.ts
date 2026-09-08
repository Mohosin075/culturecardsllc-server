import cors from 'cors'
import express, { Request, Response } from 'express'
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
import { DeepLinkRoutes } from './app/modules/deeplink/deeplink.route'

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

// -------------------- Deep Linking & Open Graph Social Previews --------------------
app.use('/', DeepLinkRoutes)

// -------------------- API Routes --------------------
app.use('/api/v1', router)

// Swagger Documentation
swaggerDocs(app, Number(config.port))

import fs from 'fs'
import { Public } from './app/modules/public/public.model'

// -------------------- Legal Documents Helpers & Routes --------------------
const getLegalFilePath = (fileName: string) => {
  const candidatePaths = [
    path.join(__dirname, fileName),
    path.join(process.cwd(), 'src', fileName),
    path.join(process.cwd(), 'dist', fileName),
    path.join(process.cwd(), fileName),
  ]
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p
  }
  return path.join(__dirname, fileName)
}

const renderLegalHtml = (
  title: string,
  content: string,
  type: 'privacy-policy' | 'terms-and-condition',
) => {
  if (content.includes('<html') || content.includes('<!doctype')) {
    return content
  }

  let bodyHtml = content
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(content)
  if (!hasHtmlTags) {
    bodyHtml = content
      .split(/\n{2,}/)
      .map(paragraph => {
        const trimmed = paragraph.trim()
        if (!trimmed) return ''
        if (trimmed.startsWith('# ')) {
          return `<h1>${trimmed.substring(2)}</h1>`
        }
        if (trimmed.startsWith('## ')) {
          return `<h2>${trimmed.substring(3)}</h2>`
        }
        if (trimmed.startsWith('### ')) {
          return `<h3>${trimmed.substring(4)}</h3>`
        }
        return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
      })
      .join('\n')
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - AREIS</title>
    <style>
      :root {
        --primary: #155dfc;
        --bg: #f8fafc;
        --card-bg: #ffffff;
        --text-main: #0f172a;
        --text-muted: #475569;
        --border: #e2e8f0;
      }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 0;
        background: var(--bg);
        color: var(--text-main);
        line-height: 1.7;
      }
      .nav-bar {
        background: #0f172a;
        padding: 16px 24px;
        color: #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .nav-brand {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #fff;
        text-decoration: none;
      }
      .nav-links a {
        color: #cbd5e1;
        text-decoration: none;
        margin-left: 20px;
        font-size: 0.95rem;
      }
      .nav-links a:hover, .nav-links a.active {
        color: #fff;
        text-decoration: underline;
      }
      .container {
        max-width: 920px;
        margin: 40px auto 60px;
        padding: 48px;
        background: var(--card-bg);
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        border: 1px solid var(--border);
      }
      h1 { text-align: center; font-size: 2.4rem; margin-bottom: 8px; color: var(--text-main); }
      h2 { color: var(--text-main); margin-top: 36px; margin-bottom: 14px; font-size: 1.4rem; border-bottom: 2px solid var(--border); padding-bottom: 8px; }
      h3 { color: var(--text-main); margin-top: 20px; margin-bottom: 8px; font-size: 1.1rem; }
      p { margin-top: 0; margin-bottom: 16px; color: var(--text-muted); }
      ul { margin-top: 0; margin-bottom: 20px; padding-left: 24px; color: var(--text-muted); }
      li { margin-bottom: 8px; }
      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }
      footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.9rem; color: var(--text-muted); }
      @media (max-width: 768px) {
        .container { margin: 16px; padding: 24px; }
        h1 { font-size: 1.8rem; }
      }
    </style>
  </head>
  <body>
    <header class="nav-bar">
      <a href="/" class="nav-brand">AREIS</a>
      <nav class="nav-links">
        <a href="/privacy-policy" class="${type === 'privacy-policy' ? 'active' : ''}">Privacy Policy</a>
        <a href="/terms-and-conditions" class="${type === 'terms-and-condition' ? 'active' : ''}">Terms & Conditions</a>
      </nav>
    </header>
    <main class="container">
      ${bodyHtml}
      <footer>
        &copy; 2026 AREIS LLC. All rights reserved.
      </footer>
    </main>
  </body>
</html>`
}

// -------------------- Public Legal Routes --------------------
app.get('/privacy-policy', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await Public.findOne({ type: 'privacy-policy' }).lean()
    if (doc && doc.content && doc.content.trim().length > 0) {
      res.send(renderLegalHtml('Privacy Policy', doc.content, 'privacy-policy'))
      return
    }
  } catch (error) {
    // Fall back to static file
  }
  const filePath = getLegalFilePath('privacy-policy.html')
  res.sendFile(filePath)
})

const handleTermsAndConditions = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await Public.findOne({ type: 'terms-and-condition' }).lean()
    if (doc && doc.content && doc.content.trim().length > 0) {
      res.send(renderLegalHtml('Terms & Conditions', doc.content, 'terms-and-condition'))
      return
    }
  } catch (error) {
    // Fall back to static file
  }
  const filePath = getLegalFilePath('terms-and-conditions.html')
  res.sendFile(filePath)
}

app.get('/terms-and-conditions', handleTermsAndConditions)
app.get('/terms', handleTermsAndConditions)
app.get('/terms-of-service', handleTermsAndConditions)

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
    message: 'Welcome to the Aries API CI/CD',
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
