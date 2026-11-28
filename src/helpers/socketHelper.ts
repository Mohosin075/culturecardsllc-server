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

/**
 * How long the server waits for a host to come back before it ends their show.
 *
 * A socket drops for all sorts of harmless reasons — the phone switches from
 * wifi to mobile data, the screen locks, the app goes to the background for a
 * moment. Ending the show on the first dropped socket kicks every viewer out
 * over a blip the host never even noticed, so the end is deferred until the
 * host has really stayed away.
 */
const HOST_DISCONNECT_GRACE_MS = 90_000

/** Streams waiting to see whether their host comes back. */
const pendingHostStreamEnd = new Map<string, NodeJS.Timeout>()

const cancelHostStreamEnd = (streamId: string) => {
  const timer = pendingHostStreamEnd.get(streamId)
  if (timer) {
    clearTimeout(timer)
    pendingHostStreamEnd.delete(streamId)
    console.log(colors.green(`Host returned to stream ${streamId}; it stays live.`))
  }
}

const scheduleHostStreamEnd = (io: Server, streamId: string) => {
  if (pendingHostStreamEnd.has(streamId)) return

  const timer = setTimeout(async () => {
    pendingHostStreamEnd.delete(streamId)
    try {
      // The host may have come back on a different socket while we waited.
      const sockets = await io.in(`stream:${streamId}`).fetchSockets()
      const hostIsBack = sockets.some(
        s => (s.data as any)?.hostedStreamId === streamId,
      )
      if (hostIsBack) return

      const liveDoc = await LiveStream.findOne({ _id: streamId, status: 'live' })
      if (!liveDoc) return // already ended, by the host or an admin

      liveDoc.status = 'ended'
      liveDoc.endedAt = new Date()
      await liveDoc.save()
      io.to(`stream:${streamId}`).emit('stream-ended', {
        streamId,
        status: 'ended',
      })
      console.log(
        colors.red(`Host never returned: ended stream ${streamId}.`),
      )
    } catch (err: any) {
      console.error(
        colors.red('Failed to end a stream after the host grace window:'),
        err?.message,
      )
    }
  }, HOST_DISCONNECT_GRACE_MS)

  pendingHostStreamEnd.set(streamId, timer)
  console.log(
    colors.yellow(
      `Host left stream ${streamId}; waiting ${HOST_DISCONNECT_GRACE_MS / 1000}s for a reconnect.`,
    ),
  )
}

/**
 * Publish the viewer count, counting the sockets actually in the room.
 *
 * The count used to be a running total in the database, nudged up and down on
 * every join and leave. One missed event — a server restart, a socket the
 * adapter never reported — and the number drifted away from reality for the
 * rest of the show. Counting the room is self-correcting instead.
 */
const syncViewerCount = async (io: Server, streamId: string): Promise<number> => {
  const streamRoom = `stream:${streamId}`
  let viewersCount: number
  try {
    const sockets = await io.in(streamRoom).fetchSockets()
    viewersCount = sockets.length
  } catch {
    viewersCount = io.sockets.adapter.rooms.get(streamRoom)?.size ?? 0
  }

  const updated = await LiveStream.findByIdAndUpdate(
    streamId,
    { $set: { viewersCount } },
    { new: true, projection: { totalJoined: 1 } },
  ).lean()
  const totalJoined = (updated as any)?.totalJoined ?? 0
  io.to(streamRoom).emit('viewer-count-update', { streamId, viewersCount, totalJoined })
  return viewersCount
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
      // Not awaited: the event handlers below must be registered straight
      // away, or a "join-stream" sent right after connecting is dropped.
      User.findByIdAndUpdate(authenticatedUserId, {
        isOnline: true,
        lastActive: new Date(),
      }).catch(err => {
        console.error(colors.red('Failed to mark user online:'), err)
      })
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

          const stream = await LiveStream.findById(streamId)

          if (stream) {
            if ((socket as any).userId && stream.sellerId.toString() === (socket as any).userId) {
              ;(socket as any).isStreamHost = true
              ;(socket as any).hostedStreamId = streamId
              // Mirrored onto socket.data so fetchSockets() can see it, which
              // is how the grace window checks whether the host is back.
              socket.data.hostedStreamId = streamId
              cancelHostStreamEnd(streamId)
            }
          }

          // Count each signed-in viewer once per show, however often they
          // rejoin, so the host sees how many people have joined in total.
          const joinerId = (socket as any).userId
          if (
            stream &&
            joinerId &&
            Types.ObjectId.isValid(joinerId) &&
            stream.sellerId.toString() !== joinerId
          ) {
            try {
              await LiveStream.updateOne(
                { _id: streamId, joinedUserIds: { $ne: joinerId } },
                { $addToSet: { joinedUserIds: joinerId }, $inc: { totalJoined: 1 } },
              )
            } catch (err: any) {
              console.error(colors.red('totalJoined update error:'), err?.message)
            }
          }

          await syncViewerCount(io, streamId)

          ;(socket as any).activeStreamId = streamId
          // Only trust the verified socket identity, never the client-sent userId
          if ((socket as any).userId) {
            (socket as any).streamUserId = (socket as any).userId
          }

          // Catch the newcomer up on the conversation: the last 50 comments.
          try {
            const withChat = await LiveStream.findById(streamId)
              .select({ chatMessages: { $slice: -50 } })
              .lean()
            const recent: any[] = (withChat as any)?.chatMessages || []
            if (recent.length) {
              const ids = [...new Set(recent.map(m => m.userId?.toString()).filter(Boolean))]
              const people = await User.find({ _id: { $in: ids } }).select('image photo').lean()
              const photo = new Map(people.map((p: any) => [p._id.toString(), p.image || p.photo || '']))
              const me = (socket as any).userId as string | undefined
              socket.emit('chat-history', {
                streamId,
                messages: recent.map(m => ({
                  messageId: m._id?.toString(),
                  user: {
                    _id: m.userId?.toString() || '',
                    name: m.user,
                    image: photo.get(m.userId?.toString()) || '',
                  },
                  message: m.message,
                  likes: (m.likedBy || []).length,
                  likedByMe: !!me && (m.likedBy || []).some((u: any) => u.toString() === me),
                  timestamp: m.timestamp,
                })),
              })
            }
          } catch (err: any) {
            console.error(colors.red('chat-history error:'), err?.message)
          }

          // Tell this viewer whether they already liked the show (one like per user).
          const uid = (socket as any).userId
          if (stream && uid && Types.ObjectId.isValid(uid)) {
            const liked = !!(await LiveStream.exists({ _id: streamId, likedBy: uid }))
            socket.emit('stream-like-state', { streamId, liked, likesCount: stream.likesCount })
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

        await syncViewerCount(io, streamId)

        if ((socket as any).isStreamHost && (socket as any).hostedStreamId === streamId) {
          // Give the host a moment to come back rather than ending the show
          // under everyone watching. An explicit "End & Exit" goes through the
          // status endpoint, so that still ends the stream straight away.
          scheduleHostStreamEnd(io, streamId)
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
        const type = reactionType || 'heart'
        const uid = (socket as any).userId

        try {
          if (type === 'heart') {
            // A like counts once per signed-in user per show.
            if (!uid || !Types.ObjectId.isValid(uid)) return
            const stream = await LiveStream.findOneAndUpdate(
              { _id: streamId, status: 'live', likedBy: { $ne: uid } },
              { $addToSet: { likedBy: uid }, $inc: { likesCount: 1 } },
              { new: true, projection: { likesCount: 1 } },
            )
            if (!stream) {
              // Already liked (or the show is over): just confirm the state.
              const current = await LiveStream.findById(streamId).select('likesCount').lean()
              socket.emit('stream-like-state', {
                streamId,
                liked: true,
                likesCount: current?.likesCount ?? 0,
              })
              return
            }
            io.to(`stream:${streamId}`).emit('new-reaction', {
              streamId,
              reactionType: 'heart',
              count: 1,
              fromUserId: uid,
              likesCount: stream.likesCount,
            })
            return
          }

          // Other emoji reactions are just animations; they don't change the like count.
          io.to(`stream:${streamId}`).emit('new-reaction', {
            streamId,
            reactionType: type,
            count: 1,
            fromUserId: uid || null,
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
          stream.endedAt = new Date()
          await stream.save()

          // Broadcast stream closure to all clients in the room
          io.to(`stream:${streamId}`).emit('stream-ended', {
            streamId,
            status: 'ended',
          })

          // Settle any auction still open in this show.
          AuctionServices.closeOpenAuctions({ streamId }).catch(err =>
            console.error('Failed to close open auctions for ended stream:', err),
          )

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

      // Republish the viewer count if they left a stream room unexpectedly
      const streamId = (socket as any).activeStreamId
      if (streamId) {
        await syncViewerCount(io, streamId)
      }

      if ((socket as any).isStreamHost && (socket as any).hostedStreamId) {
        // A dropped socket is not the same as a host who meant to stop. Wait
        // out the grace window; if they reconnect, the show never flinched.
        scheduleHostStreamEnd(io, (socket as any).hostedStreamId)
      }
    })
  })
}

export const socketHelper = { socket }
