import colors from 'colors'
import mongoose from 'mongoose'
import { Server as SocketServer } from 'socket.io'
import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'
import app from './app'
import config from './config'
import os from 'os'

import { UserServices } from './app/modules/user/user.service'
import { socketHelper } from './helpers/socketHelper'
import { seedSubscriptionPlans } from './app/modules/subscription/subscription.seed'
import { logger, errorLogger } from './shared/logger'
import { startTradeExpiryCron } from './task/tradeExpiryCron'
import { startOrderAutoDeliverCron } from './task/orderAutoDeliverCron'

// Uncaught exceptions
process.on('uncaughtException', error => {
  errorLogger.error('🔥 UncaughtException Detected:', error)
  process.exit(1)
})

export const onlineUsers = new Map()
let server: any

export let io: SocketServer

async function main() {
  try {
    await mongoose.connect(config.database_url as string)
    logger.info(colors.green('🚀 Database connected successfully'))

    const port =
      typeof config.port === 'number' ? config.port : Number(config.port)

    server = app.listen(port, '0.0.0.0', () => {
      logger.info(colors.yellow(`♻️  Server is running on:`))
      logger.info(colors.cyan(`   - Local:    http://localhost:${port}`))

      const interfaces = os.networkInterfaces()
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
          if (iface.family === 'IPv4' && !iface.internal) {
            logger.info(
              colors.cyan(`   - Network:  http://${iface.address}:${port}`),
            )
          }
        }
      }

      if (config.ip_address) {
        logger.info(
          colors.green(
            `   - Requested IP: http://${config.ip_address}:${port}`,
          ),
        )
      }
    })

    // Determine allowed CORS origins for Socket.IO
    const socketCorsOrigin =
      config.cors_origins.length > 0 ? config.cors_origins : '*'

    // Socket.IO setup
    io = new SocketServer(server, {
      pingTimeout: 60000,
      cors: {
        origin: socketCorsOrigin,
        credentials: true,
      },
    })

    // Redis Adapter — enabled only when REDIS_URL is configured
    if (config.redis_url) {
      try {
        const pubClient = createClient({ url: config.redis_url })
        const subClient = pubClient.duplicate()

        pubClient.on('error', err =>
          errorLogger.error('Redis pubClient error:', err),
        )
        subClient.on('error', err =>
          errorLogger.error('Redis subClient error:', err),
        )

        await Promise.all([pubClient.connect(), subClient.connect()])
        io.adapter(createAdapter(pubClient, subClient))
        logger.info(
          colors.green(
            '🔴 Redis adapter connected — Socket.IO is horizontally scalable',
          ),
        )
      } catch (redisError) {
        errorLogger.error(
          colors.red('⚠️  Redis connection failed, falling back to in-memory adapter:'),
          redisError,
        )
      }
    } else {
      logger.info(
        colors.yellow(
          '⚠️  REDIS_URL not set — using in-memory Socket.IO adapter (single instance only)',
        ),
      )
    }

    // Create admin user
    await UserServices.createAdmin()

    // Seed subscription plans
    await seedSubscriptionPlans()

    // Socket helper
    socketHelper.socket(io);
    (global as any).io = io

    // Start background cron jobs
    startTradeExpiryCron()
    startOrderAutoDeliverCron()

    logger.info(colors.green('🍁 Socket.IO initialized successfully'))
  } catch (error) {
    errorLogger.error(
      colors.red('🤢 Failed to start the server or connect to DB'),
      error,
    )
  }

  // Handle unhandled promise rejections
  process.on('unhandledRejection', error => {
    if (server) {
      server.close(() => {
        errorLogger.error('🔥 UnhandledRejection Detected:', error)
        process.exit(1)
      })
    } else {
      errorLogger.error('🔥 UnhandledRejection Detected:', error)
      process.exit(1)
    }
  })
}

// Start main
main()

// Graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
  logger.info('👋 SIGTERM received, shutting down server...')
  if (server) {
    server.close()
  }
})
