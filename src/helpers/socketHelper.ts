import colors from 'colors'
import { Server } from 'socket.io'
import { User } from '../app/modules/user/user.model'

const socket = (io: Server) => {
  io.on('connection', socket => {
    console.log(colors.blue('A user connected'), socket.id)

    // Join notification room (user specific)
    socket.on('join-notification', async (userId: string) => {
      if (userId) {
        socket.join(userId)
        console.log(
          colors.green(`User ${socket.id} joined notification room:${userId}`),
        )

        // Update user status to online
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastActive: new Date(),
        })

        // Associate userId with socket for disconnect handling
        ;(socket as any).userId = userId
      }
    })

    //disconnect
    socket.on('disconnect', async () => {
      console.log(colors.red('A user disconnect'), socket.id)
      const userId = (socket as any).userId
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActive: new Date(),
        })
      }
    })

    // Join stream room
    socket.on('join-stream', (streamId: string) => {
      if (streamId) {
        socket.join(`stream:${streamId}`)
        console.log(colors.green(`User ${socket.id} joined stream:${streamId}`))
      }
    })

    // Leave stream room
    socket.on('leave-stream', (streamId: string) => {
      if (streamId) {
        socket.leave(`stream:${streamId}`)
        console.log(colors.yellow(`User ${socket.id} left stream:${streamId}`))
      }
    })
  })
}

export const socketHelper = { socket }
