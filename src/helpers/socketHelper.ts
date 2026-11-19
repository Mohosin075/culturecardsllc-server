import colors from 'colors'
import { Server, Socket } from 'socket.io'
import { User } from '../app/modules/user/user.model'
import { LiveStream } from '../app/modules/auction/auction.model'
import { AuctionServices } from '../app/modules/auction/auction.service'
import { jwtHelper } from './jwtHelper'
import config from '../config'
import { Secret } from 'jsonwebtoken'
import { Types } from 'mongoose'

/**
 * Verify the JWT sent in the socket handshake (auth.token, query.token or
 * Authorization header) and return the user id, or null if absent/invalid.
 */
const resolveSocketUserId = (socket: Socket): string | null => {
  const raw =
    (socket.handshake.auth as any)?.token ||
    (socket.handshake.query as any)?.token ||
    socket.handshake.headers.authorization
  if (!raw || typeof raw !== 'string') return null
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw
  try {
    const payload = jwtHelper.verifyToken(token, config.jwt.jwt_secret as Secret)
    const id = payload.userId || payload.authId
    return id ? String(id) : null
  } catch {
    return null
  }
}

const socket = (io: Server) => {
  io.on('connection', async (socket: Socket) => {
    console.log(colors.blue('A user connected:'), socket.id)

    // Security: identity comes ONLY from a verified JWT in the handshake.
    // Unauthenticated sockets may still connect (e.g. to watch), but they have
    // no userId, so every privileged event below rejects them.
    const authenticatedUserId = resolveSocketUserId(socket)
    if (authenticatedUserId) {
      ;(socket as any).userId = authenticatedUserId
      socket.data.userId = authenticatedUserId // survives fetchSockets() across Redis nodes
      socket.join(authenticatedUserId)
      try {
        await User.findByIdAndUpdate(authenticatedUserId, {
          isOnline: true,
          lastActive: new Date(),
        })
      } catch (err) {
        console.error(colors.red('Failed to mark user online:'), err)
      }
    }

    // 1. Notification room registration (kept for backwards compatibility).
    // The client-sent id is ignored unless it matches the verified token.
    socket.on('join-notification', async (userId: string) => {
      const verifiedId = (socket as any).userId
      if (!verifiedId || (userId && String(userId) !== String(verifiedId))) {
        socket.emit('socket_error', {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Valid access token required to join notifications.',
        })
        return
      }
      socket.join(verifiedId)
    })

    // 2. Room subscriptions & live viewer tracking
    socket.on(
      'join-stream',
      async (data: { streamId: string; userId?: string }) => {
        const { streamId, userId } = data
        if (streamId) {
          const streamRoom = `stream:${streamId}`
          // Re-joins (e.g. after a reconnect) must not inflate the viewer count.
          if (socket.rooms.has(streamRoom)) return
          socket.join(streamRoom)
          console.log(
            colors.green(`User ${socket.id} joined stream room: ${streamId}`),
          )

          // Increment Mongoose stream viewer count
          const stream = await LiveStream.findByIdAndUpdate(
            streamId,
            { $inc: { viewersCount: 1 } },
            { new: true },
          )

          if (stream) {
            io.to(streamRoom).emit('viewer-count-update', {
              streamId,
              viewersCount: stream.viewersCount,
            })
            if ((socket as any).userId && stream.sellerId.toString() === (socket as any).userId) {
              ;(socket as any).isStreamHost = true
              ;(socket as any).hostedStreamId = streamId
            }
          }

          (socket as any).activeStreamId = streamId
          // Only trust the verified socket identity, never the client-sent userId
          if ((socket as any).userId) {
            (socket as any).streamUserId = (socket as any).userId
          }
        }
      },
    )

    socket.on('leave-stream', async (data: any) => {
      const streamId = typeof data === 'string' ? data : data?.streamId
      if (streamId) {
        const streamRoom = `stream:${streamId}`
        socket.leave(streamRoom)
        console.log(
          colors.yellow(`User ${socket.id} left stream room: ${streamId}`),
        )

        const stream = await LiveStream.findByIdAndUpdate(
          streamId,
          { $inc: { viewersCount: -1 } },
          { new: true },
        )

        const currentCount =
          stream && stream.viewersCount > 0 ? stream.viewersCount : 0
        if (stream && stream.viewersCount < 0) {
          await LiveStream.findByIdAndUpdate(streamId, {
            $set: { viewersCount: 0 },
          })
        }

        io.to(streamRoom).emit('viewer-count-update', {
          streamId,
          viewersCount: currentCount,
        })

        if ((socket as any).isStreamHost && (socket as any).hostedStreamId === streamId) {
          const liveStream = await LiveStream.findById(streamId)
          if (liveStream && liveStream.status === 'live') {
            liveStream.status = 'ended'
            liveStream.endedAt = new Date()
            await liveStream.save()
            io.to(streamRoom).emit('stream-ended', { streamId, status: 'ended' })
            console.log(colors.red(`Host left: ended stream ${streamId}`))
          }
        }

        ;(socket as any).activeStreamId = null
      }
    })

    // 3. High-Concurrency Bidding Logic with Race-Condition Protection
    socket.on(
      'place-bid',
      async (data: {
        streamId: string
        auctionItemId: string
        bidAmount: number
      }) => {
        const { streamId, auctionItemId, bidAmount } = data

        // Security: ALWAYS use the authenticated socket userId — never trust client-provided bidderId
        const authenticatedBidderId = (socket as any).userId

        try {
          if (!auctionItemId || !bidAmount) {
            socket.emit('bid-error', {
              message: 'Missing required bid parameters.',
            })
            return
          }

          if (!authenticatedBidderId) {
            socket.emit('bid-error', {
              message: 'Unauthorized: Please join the notification room first (join-notification).',
            })
            return
          }

          // Call the secure service that uses Mongoose lock validators and anti-sniping timers
          const updatedAuction = await AuctionServices.placeBidSecure(
            auctionItemId,
            authenticatedBidderId,
            bidAmount,
          )

          // Fetch bidder profile for display name in feed
          const bidderInfo = await User.findById(authenticatedBidderId).select(
            'name fullName email image photo',
          )

          // Broadcast updated auction item to stream room
          io.to(`stream:${streamId}`).emit('new-bid', {
            streamId,
            auctionItemId,
            currentBid: updatedAuction.currentBid,
            highestBidder: bidderInfo,
            endsAt: updatedAuction.endsAt,
          })

          console.log(
            colors.green(
              `Bid placed successfully: $${bidAmount} by User:${authenticatedBidderId}`,
            ),
          )
        } catch (err: any) {
          console.error(colors.red('Bidding error:'), err.message)
          socket.emit('bid-error', {
            auctionItemId,
            message:
              err.message || 'Bid rejected due to concurrency collision.',
          })
        }
      },
    )

    // 4. Live Chat Overlay (comments) — server is the single source of truth.
    socket.on(
      'stream-chat',
      async (data: { streamId: string; message: string; clientId?: string }) => {
        try {
          const streamId = data?.streamId
          const authenticatedUserId = (socket as any).userId
          const message = (data?.message ?? '').toString().trim().slice(0, 300)
          if (!authenticatedUserId || !message || !streamId || !Types.ObjectId.isValid(streamId)) return

          // Basic anti-spam: max ~2 comments per second per socket
          const now = Date.now()
          const last = (socket as any).lastChatAt || 0
          if (now - last < 450) {
            socket.emit('stream-chat-error', { clientId: data?.clientId, message: 'You are sending messages too fast.' })
            return
          }
          ;(socket as any).lastChatAt = now

          const userInfo = await User.findById(authenticatedUserId).select('name fullName image photo')
          const displayName = userInfo?.fullName || userInfo?.name || 'User'
          const messageId = new Types.ObjectId()
          const timestamp = new Date()

          const updated = await LiveStream.findOneAndUpdate(
            { _id: streamId, status: { $in: ['live', 'scheduled'] } },
            {
              $push: {
                chatMessages: {
                  _id: messageId,
                  user: displayName,
                  userId: new Types.ObjectId(authenticatedUserId),
                  message,
                  timestamp,
                  likedBy: [],
                },
              },
            },
            { projection: { _id: 1 } },
          )
          if (!updated) {
            socket.emit('stream-chat-error', { clientId: data?.clientId, message: 'This show has ended.' })
            return
          }

          io.to(`stream:${streamId}`).emit('new-chat-message', {
            streamId,
            messageId: messageId.toString(),
            clientId: data?.clientId,
            user: {
              _id: authenticatedUserId,
              name: displayName,
              image: (userInfo as any)?.image || (userInfo as any)?.photo || '',
            },
            message,
            likes: 0,
            timestamp,
          })
        } catch (err: any) {
          console.error(colors.red('stream-chat error:'), err?.message)
        }
      },
    )

    // 4b. Like / unlike a comment (toggle, atomic, one like per user)
    socket.on(
      'stream-chat-like',
      async (data: { streamId: string; messageId: string }) => {
        try {
          const authenticatedUserId = (socket as any).userId
          const { streamId, messageId } = data || ({} as any)
          if (!authenticatedUserId || !Types.ObjectId.isValid(streamId) || !Types.ObjectId.isValid(messageId)) return
          const uid = new Types.ObjectId(authenticatedUserId)
          const mid = new Types.ObjectId(messageId)

          // Try to add the like; if the user already liked it, remove it instead.
          let liked = true
          let doc = await LiveStream.findOneAndUpdate(
            { _id: streamId, chatMessages: { $elemMatch: { _id: mid, likedBy: { $ne: uid } } } },
            { $addToSet: { 'chatMessages.$.likedBy': uid } },
            { new: true, projection: { chatMessages: { $elemMatch: { _id: mid } } } },
          )
          if (!doc) {
            liked = false
            doc = await LiveStream.findOneAndUpdate(
              { _id: streamId, 'chatMessages._id': mid },
              { $pull: { 'chatMessages.$.likedBy': uid } },
              { new: true, projection: { chatMessages: { $elemMatch: { _id: mid } } } },
            )
          }
          const msg: any = (doc as any)?.chatMessages?.[0]
          if (!msg) return

          io.to(`stream:${streamId}`).emit('chat-message-liked', {
            streamId,
            messageId,
            likes: (msg.likedBy || []).length,
            userId: authenticatedUserId,
            liked,
          })
        } catch (err: any) {
          console.error(colors.red('stream-chat-like error:'), err?.message)
        }
      },
    )

    // 5. Live Reactions Count
    socket.on(
      'stream-reaction',
      async (data: { streamId: string; reactionType: string; count?: number }) => {
        const { streamId, reactionType } = data || ({} as any)
        if (!streamId || !Types.ObjectId.isValid(streamId)) return

        // Clients batch taps (~1/sec). Cap each batch and rate-limit per socket
        // so a modified client can't flood the DB or the room.
        const now = Date.now()
        const last = (socket as any).lastReactionAt || 0
        if (now - last < 500) return
        ;(socket as any).lastReactionAt = now
        const count = Math.min(Math.max(Math.floor(Number(data.count) || 1), 1), 30)

        try {
          const stream = await LiveStream.findOneAndUpdate(
            { _id: streamId, status: 'live' },
            { $inc: { likesCount: count } },
            { new: true, projection: { likesCount: 1 } },
          )
          if (!stream) return

          io.to(`stream:${streamId}`).emit('new-reaction', {
            streamId,
            reactionType: reactionType || 'heart',
            count,
            fromUserId: (socket as any).userId || null,
            likesCount: stream.likesCount,
          })
        } catch (err) {
          console.error(colors.red('stream-reaction error:'), err)
        }
      },
    )

    // 6. Seller-controlled Spin Wheel Drop Calculation
    // Legacy random-prize spin (hardcoded prizes + global giveaway draw) is
    // disabled: it awarded prizes the seller never entered and marked random
    // platform giveaway participants as winners. The app uses the REST
    // spin-wheel endpoint, which spins the seller's own entries.
    socket.on('trigger-spin', () => {
      socket.emit('spin-error', {
        message: 'Please use the Spin Wheel in the latest app version.',
      })
    })

    // 6b. Seller-controlled Attach Spin Wheel Prize to Order
    socket.on(
      'attach-spin-prize',
      async (data: {
        streamId: string
        itemName: string
        buyerId?: string
        auctionItemId?: string
      }) => {
        const { streamId, itemName, buyerId, auctionItemId } = data
        const authenticatedSellerId = (socket as any).userId
        try {
          if (!authenticatedSellerId) {
            socket.emit('spin-error', { message: 'Unauthorized: Not authenticated.' })
            return
          }
          if (!streamId || !itemName) {
            socket.emit('spin-error', { message: 'Missing streamId or itemName.' })
            return
          }
          await AuctionServices.attachSpinWheelPrize(streamId, authenticatedSellerId, {
            itemName,
            buyerId,
            auctionItemId,
          })
        } catch (err: any) {
          socket.emit('spin-error', {
            message: err.message || 'Failed to attach spin prize.',
          })
        }
      },
    )

    // 6c. Seller-controlled Run Item Giveaway
    socket.on(
      'run-giveaway-item',
      async (data: {
        streamId: string
        itemTitle: string
        productId?: string
        itemImage?: string
      }) => {
        const { streamId, itemTitle, productId, itemImage } = data
        const authenticatedSellerId = (socket as any).userId
        try {
          if (!authenticatedSellerId) {
            socket.emit('giveaway-error', { message: 'Unauthorized: Not authenticated.' })
            return
          }
          if (!streamId || !itemTitle) {
            socket.emit('giveaway-error', { message: 'Missing streamId or itemTitle.' })
            return
          }
          await AuctionServices.runStreamGiveawayItem(streamId, authenticatedSellerId, {
            itemTitle,
            productId,
            itemImage,
          })
        } catch (err: any) {
          socket.emit('giveaway-error', {
            message: err.message || 'Failed to run item giveaway.',
          })
        }
      },
    )

    // 7. Seller-controlled Live Stream termination
    socket.on(
      'end-stream',
      async (data: { streamId: string }) => {
        const { streamId } = data
        // Security: use authenticated socket userId — never trust client-provided sellerId
        const authenticatedSellerId = (socket as any).userId
        try {
          if (!streamId) {
            socket.emit('stream-error', {
              message: 'Missing required parameter: streamId.',
            })
            return
          }

          if (!authenticatedSellerId) {
            socket.emit('stream-error', { message: 'Unauthorized: Not authenticated.' })
            return
          }

          const stream = await LiveStream.findById(streamId)
          if (!stream) {
            socket.emit('stream-error', { message: 'Stream session not found.' })
            return
          }

          // Authorize: Only the stream host can end the stream
          if (stream.sellerId.toString() !== authenticatedSellerId) {
            socket.emit('stream-error', {
              message: 'Unauthorized: Only the stream host can end the stream.',
            })
            return
          }

          stream.status = 'ended'
          await stream.save()

          // Broadcast stream closure to all clients in the room
          io.to(`stream:${streamId}`).emit('stream-ended', {
            streamId,
            status: 'ended',
          })

          console.log(
            colors.red(
              `Live Stream ${streamId} terminated by host seller ${authenticatedSellerId}`,
            ),
          )
        } catch (err: any) {
          socket.emit('stream-error', {
            message: err.message || 'Failed to end stream session.',
          })
        }
      },
    )

    // Handle Disconnections
    socket.on('disconnect', async () => {
      console.log(colors.red('A user disconnected:'), socket.id)

      // Update online status
      const userId = (socket as any).userId
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActive: new Date(),
        })
      }

      // Decrement viewer count if they left a stream room unexpectedly
      const streamId = (socket as any).activeStreamId
      if (streamId) {
        const stream = await LiveStream.findByIdAndUpdate(
          streamId,
          { $inc: { viewersCount: -1 } },
          { new: true },
        )

        const currentCount =
          stream && stream.viewersCount > 0 ? stream.viewersCount : 0
        if (stream && stream.viewersCount < 0) {
          await LiveStream.findByIdAndUpdate(streamId, {
            $set: { viewersCount: 0 },
          })
        }

        io.to(`stream:${streamId}`).emit('viewer-count-update', {
          streamId,
          viewersCount: currentCount,
        })
      }

      if ((socket as any).isStreamHost && (socket as any).hostedStreamId) {
        const streamId = (socket as any).hostedStreamId
        const liveDoc = await LiveStream.findOne({ _id: streamId, status: 'live' })
        if (liveDoc) {
          liveDoc.status = 'ended'
          liveDoc.endedAt = new Date()
          await liveDoc.save()
          io.to(`stream:${streamId}`).emit('stream-ended', { streamId, status: 'ended' })
          console.log(colors.red(`Host disconnected: marked stream ${streamId} as ended.`))
        }
      }
    })
  })
}

export const socketHelper = { socket }
