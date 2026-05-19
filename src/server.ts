import colors from 'colors'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import app from './app'
import config from './config'
import os from 'os'

import { Server as SocketServer } from 'socket.io'
import { UserServices } from './app/modules/user/user.service'
import { socketHelper } from './helpers/socketHelper'
import { seedSubscriptionPlans } from './app/modules/subscription/subscription.seed'
import { logger, errorLogger } from './shared/logger'

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

    // Socket.IO setup
    io = new Server(server, {
      pingTimeout: 60000,
      cors: { origin: '*' },
    })

    // Create admin user
    await UserServices.createAdmin()

    // Seed subscription plans
    await seedSubscriptionPlans()

    // Socket helper
    socketHelper.socket(io)
    global.io = io

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
