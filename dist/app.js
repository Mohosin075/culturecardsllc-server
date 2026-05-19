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
const app = (0, express_1.default)();
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
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
// CORS - Using env based origins
app.use((0, cors_1.default)({
    origin: config_1.default.cors_origins.length > 0 ? config_1.default.cors_origins : ['*'],
    credentials: true,
}));
// Cookie parser
app.use((0, cookie_parser_1.default)());
// Logging
app.use((0, morgan_1.default)('dev'));
// -------------------- Static Files --------------------
// Serve uploads folder statically
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// -------------------- API Routes --------------------
app.use('/api/v1', routes_1.default);
// Swagger Documentation
(0, swagger_1.default)(app, Number(config_1.default.port));
// -------------------- Privacy Policy --------------------
app.get('/privacy-policy', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'privacy-policy.html'));
});
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
        message: 'Welcome to the Photopya API',
        data: {
            timestamp: new Date().toISOString(),
            projectName: 'Photopya',
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
