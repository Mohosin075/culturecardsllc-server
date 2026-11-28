import colors from 'colors'
import { io } from '../server'
import { LiveStream } from '../app/modules/auction/auction.model'

/**
 * Stale stream sweeper. Runs every minute.
 *
 * The host-disconnect timer in socketHelper ends a show 90s after its host
 * leaves, but it lives in memory: a server restart or deploy forgets every
 * pending timer, and a show whose host never reconnected stays "live" forever
 * (test streams once stayed live for 14+ hours).
 *
 * This is the safety net. A live stream whose host socket has been missing
 * for STALE_AFTER_MS in a row is ended and its room told.
 */
const STALE_AFTER_MS = 5 * 60_000
const SWEEP_EVERY_MS = 60_000

/** streamId -> when the sweeper first noticed the host was missing. */
const hostMissingSince = new Map<string, number>()

let running = false

const sweep = async () => {
  const live = await LiveStream.find({ status: 'live' }).select('_id').lean()
  const liveIds = new Set(live.map(s => String(s._id)))

  // Forget streams that ended or whose host came back.
  for (const id of [...hostMissingSince.keys()]) {
    if (!liveIds.has(id)) hostMissingSince.delete(id)
  }

  const now = Date.now()
  for (const id of liveIds) {
    const sockets = await io.in(`stream:${id}`).fetchSockets()
    const hostPresent = sockets.some(s => (s.data as any)?.hostedStreamId === id)

    if (hostPresent) {
      hostMissingSince.delete(id)
      continue
    }

    const since = hostMissingSince.get(id)
    if (since === undefined) {
      hostMissingSince.set(id, now)
      continue
    }
    if (now - since < STALE_AFTER_MS) continue

    // Conditional update: never revive or double-end a stream.
    const ended = await LiveStream.findOneAndUpdate(
      { _id: id, status: 'live' },
      { $set: { status: 'ended', endedAt: new Date() } },
    )
    hostMissingSince.delete(id)
    if (!ended) continue

    io.to(`stream:${id}`).emit('stream-ended', { streamId: id, status: 'ended' })
    console.log(colors.red(`[StaleStreamSweeper] Ended abandoned stream ${id}.`))
  }
}

export const startStaleStreamSweeper = () => {
  setInterval(async () => {
    if (running) return
    running = true
    try {
      await sweep()
    } catch (err) {
      console.error('[StaleStreamSweeper] sweep failed:', err)
    } finally {
      running = false
    }
  }, SWEEP_EVERY_MS)
  console.log('⏰ Stale stream sweeper started (every 60s).')
}
