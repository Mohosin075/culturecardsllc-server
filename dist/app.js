"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_status_codes_1 = require("http-status-codes");
const path_1 = __importDefault(require("path"));
const express_session_1 = __importDefault(require("express-session"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const passport_1 = __importDefault(require("./app/modules/auth/passport.auth/config/passport"));
const routes_1 = __importDefault(require("./routes"));
const globalErrorHandler_1 = __importDefault(require("./app/middleware/globalErrorHandler"));
const config_1 = __importDefault(require("./config"));
const webhook_1 = __importDefault(require("./webhook"));
const sendResponse_1 = __importDefault(require("./shared/sendResponse"));
const morgan_1 = __importDefault(require("morgan"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_1 = __importDefault(require("./utils/swagger"));
const deeplink_route_1 = require("./app/modules/deeplink/deeplink.route");
const app = (0, express_1.default)();
// ✅ CORS MUST be first — before helmet, session, passport, everything
// This ensures preflight OPTIONS requests get correct headers
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = config_1.default.cors_origins.length > 0
            ? config_1.default.cors_origins
            : ['http://localhost:3000'];
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS: Origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Accept'],
}));
// Handle preflight requests for all routes
app.options('*', (0, cors_1.default)());
// Security headers
app.use((0, helmet_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});
if (config_1.default.node_env !== 'development') {
    app.use('/api', limiter);
}
// ⚠️ CRITICAL: Webhook MUST be before body parsers to receive raw body
app.use(webhook_1.default);
// -------------------- Middleware --------------------
// Body parsers must come after webhook
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Session must come before passport
app.use((0, express_session_1.default)({
    secret: config_1.default.jwt.jwt_secret || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config_1.default.node_env === 'production', // true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
}));
// Initialize Passport
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// CORS is already applied at the top of the middleware stack
// Cookie parser
app.use((0, cookie_parser_1.default)());
// Logging
app.use((0, morgan_1.default)('dev'));
// -------------------- Static Files --------------------
// Serve uploads folder statically
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// -------------------- Deep Linking & Open Graph Social Previews --------------------
app.use('/', deeplink_route_1.DeepLinkRoutes);
// -------------------- API Routes --------------------
app.use('/api/v1', routes_1.default);
// Swagger Documentation
(0, swagger_1.default)(app, Number(config_1.default.port));
const fs_1 = __importDefault(require("fs"));
const public_model_1 = require("./app/modules/public/public.model");
// -------------------- Legal Documents Helpers & Routes --------------------
const getLegalFilePath = (fileName) => {
    const candidatePaths = [
        path_1.default.join(__dirname, fileName),
        path_1.default.join(process.cwd(), 'src', fileName),
        path_1.default.join(process.cwd(), 'dist', fileName),
        path_1.default.join(process.cwd(), fileName),
    ];
    for (const p of candidatePaths) {
        if (fs_1.default.existsSync(p))
            return p;
    }
    return path_1.default.join(__dirname, fileName);
};
const renderLegalHtml = (title, content, type) => {
    if (content.includes('<html') || content.includes('<!doctype')) {
        return content;
    }
    let bodyHtml = content;
    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(content);
    if (!hasHtmlTags) {
        bodyHtml = content
            .split(/\n{2,}/)
            .map(paragraph => {
            const trimmed = paragraph.trim();
            if (!trimmed)
                return '';
            if (trimmed.startsWith('# ')) {
                return `<h1>${trimmed.substring(2)}</h1>`;
            }
            if (trimmed.startsWith('## ')) {
                return `<h2>${trimmed.substring(3)}</h2>`;
            }
            if (trimmed.startsWith('### ')) {
                return `<h3>${trimmed.substring(4)}</h3>`;
            }
            return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
        })
            .join('\n');
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
</html>`;
};
// -------------------- Public Legal Routes --------------------
app.get('/privacy-policy', async (req, res) => {
    try {
        const doc = await public_model_1.Public.findOne({ type: 'privacy-policy' }).lean();
        if (doc && doc.content && doc.content.trim().length > 0) {
            res.send(renderLegalHtml('Privacy Policy', doc.content, 'privacy-policy'));
            return;
        }
    }
    catch (error) {
        // Fall back to static file
    }
    const filePath = getLegalFilePath('privacy-policy.html');
    res.sendFile(filePath);
});
const handleTermsAndConditions = async (req, res) => {
    try {
        const doc = await public_model_1.Public.findOne({ type: 'terms-and-condition' }).lean();
        if (doc && doc.content && doc.content.trim().length > 0) {
            res.send(renderLegalHtml('Terms & Conditions', doc.content, 'terms-and-condition'));
            return;
        }
    }
    catch (error) {
        // Fall back to static file
    }
    const filePath = getLegalFilePath('terms-and-conditions.html');
    res.sendFile(filePath);
};
app.get('/terms-and-conditions', handleTermsAndConditions);
app.get('/terms', handleTermsAndConditions);
app.get('/terms-of-service', handleTermsAndConditions);
routes_1.default.get('/status', (req, res) => {
    try {
        const healthCheck = {
            success: true,
            message: 'Server is running smoothly',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: config_1.default.node_env,
        };
        res.status(http_status_codes_1.StatusCodes.OK).json(healthCheck);
    }
    catch (error) {
        res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server is experiencing issues',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// -------------------- Root Response --------------------
app.get('/', (req, res) => {
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Welcome to the Aries API CI/CD',
        data: {
            timestamp: new Date().toISOString(),
            projectName: 'Aries',
            version: '1.0.0',
        },
    });
});
// -------------------- Global Error Handler --------------------
app.use(globalErrorHandler_1.default);
// -------------------- 404 Handler --------------------
app.use((req, res) => {
    res.status(http_status_codes_1.StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'The requested resource was not found on this server.',
        errorMessages: [
            {
                path: req.originalUrl,
                message: 'Endpoint does not exist',
            },
        ],
        timestamp: new Date().toISOString(),
    });
});
exports.default = app;
