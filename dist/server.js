"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.onlineUsers = void 0;
const colors_1 = __importDefault(require("colors"));
const mongoose_1 = __importDefault(require("mongoose"));
const socket_io_1 = require("socket.io");
const redis_1 = require("redis");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config"));
const os_1 = __importDefault(require("os"));
const user_service_1 = require("./app/modules/user/user.service");
const socketHelper_1 = require("./helpers/socketHelper");
const subscription_seed_1 = require("./app/modules/subscription/subscription.seed");
const logger_1 = require("./shared/logger");
const tradeExpiryCron_1 = require("./task/tradeExpiryCron");
// Uncaught exceptions
process.on('uncaughtException', error => {
    logger_1.errorLogger.error('🔥 UncaughtException Detected:', error);
    process.exit(1);
});
exports.onlineUsers = new Map();
let server;
async function main() {
    try {
        await mongoose_1.default.connect(config_1.default.database_url);
        logger_1.logger.info(colors_1.default.green('🚀 Database connected successfully'));
        const port = typeof config_1.default.port === 'number' ? config_1.default.port : Number(config_1.default.port);
        server = app_1.default.listen(port, '0.0.0.0', () => {
            logger_1.logger.info(colors_1.default.yellow(`♻️  Server is running on:`));
            logger_1.logger.info(colors_1.default.cyan(`   - Local:    http://localhost:${port}`));
            const interfaces = os_1.default.networkInterfaces();
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        logger_1.logger.info(colors_1.default.cyan(`   - Network:  http://${iface.address}:${port}`));
                    }
                }
            }
            if (config_1.default.ip_address) {
                logger_1.logger.info(colors_1.default.green(`   - Requested IP: http://${config_1.default.ip_address}:${port}`));
            }
        });
        // Determine allowed CORS origins for Socket.IO
        const socketCorsOrigin = config_1.default.cors_origins.length > 0 ? config_1.default.cors_origins : '*';
        // Socket.IO setup
        exports.io = new socket_io_1.Server(server, {
            pingTimeout: 60000,
            cors: {
                origin: socketCorsOrigin,
                credentials: true,
            },
        });
        // Redis Adapter — enabled only when REDIS_URL is configured
        if (config_1.default.redis_url) {
            try {
                const pubClient = (0, redis_1.createClient)({ url: config_1.default.redis_url });
                const subClient = pubClient.duplicate();
                pubClient.on('error', err => logger_1.errorLogger.error('Redis pubClient error:', err));
                subClient.on('error', err => logger_1.errorLogger.error('Redis subClient error:', err));
                await Promise.all([pubClient.connect(), subClient.connect()]);
                exports.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
                logger_1.logger.info(colors_1.default.green('🔴 Redis adapter connected — Socket.IO is horizontally scalable'));
            }
            catch (redisError) {
                logger_1.errorLogger.error(colors_1.default.red('⚠️  Redis connection failed, falling back to in-memory adapter:'), redisError);
            }
        }
        else {
            logger_1.logger.info(colors_1.default.yellow('⚠️  REDIS_URL not set — using in-memory Socket.IO adapter (single instance only)'));
        }
        // Create admin user
        await user_service_1.UserServices.createAdmin();
        // Seed subscription plans
        await (0, subscription_seed_1.seedSubscriptionPlans)();
        // Socket helper
        socketHelper_1.socketHelper.socket(exports.io);
        global.io = exports.io;
        // Start background cron jobs
        (0, tradeExpiryCron_1.startTradeExpiryCron)();
        logger_1.logger.info(colors_1.default.green('🍁 Socket.IO initialized successfully'));
    }
    catch (error) {
        logger_1.errorLogger.error(colors_1.default.red('🤢 Failed to start the server or connect to DB'), error);
    }
    // Handle unhandled promise rejections
    process.on('unhandledRejection', error => {
        if (server) {
            server.close(() => {
                logger_1.errorLogger.error('🔥 UnhandledRejection Detected:', error);
                process.exit(1);
            });
        }
        else {
            logger_1.errorLogger.error('🔥 UnhandledRejection Detected:', error);
            process.exit(1);
        }
    });
}
// Start main
main();
// Graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
    logger_1.logger.info('👋 SIGTERM received, shutting down server...');
    if (server) {
        server.close();
    }
});
