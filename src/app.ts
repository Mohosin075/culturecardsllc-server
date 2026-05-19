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

const app = express()

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
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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

// CORS - Using env based origins
app.use(
  cors({
    origin: config.cors_origins.length > 0 ? config.cors_origins : ['*'],
    credentials: true,
  }),
)

// Cookie parser
app.use(cookieParser())

// Logging
app.use(morgan('dev'))

// -------------------- Static Files --------------------
// Serve uploads folder statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

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
    message: 'Welcome to the Photopya API',
    data: {
      timestamp: new Date().toISOString(),
      projectName: 'Photopya',
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
