import { Server } from 'socket.io'
import { JwtPayload } from 'jsonwebtoken'
import 'express-session'

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload & {
        userId: string
        authId: string
        role: string
        name?: string
        email?: string
        deviceToken?: string
      }
    }
  }
  var io: Server
}

declare module 'express-session' {
  type SessionData = {
    connectType?: 'facebook' | 'instagram'
  }
}
