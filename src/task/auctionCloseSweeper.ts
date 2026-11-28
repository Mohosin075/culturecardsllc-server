import { AuctionServices } from '../app/modules/auction/auction.service'

/**
 * Auction close sweeper. Runs every 10 seconds.
 *
 * The host's app closes an auction when its timer ends. If that app is
 * backgrounded or offline at that moment, this closes it instead a few
 * seconds later, so the winner is still charged (or sent a payment link)
 * and the item is free to be auctioned again.
 */
let running = false

export const startAuctionCloseSweeper = () => {
  setInterval(async () => {
    if (running) return
    running = true
    try {
      await AuctionServices.closeOpenAuctions({ graceMs: 5000 })
    } catch (err) {
      console.error('[AuctionClose] sweep failed:', err)
    } finally {
      running = false
    }
  }, 10_000)
  console.log('⏰ Auction close sweeper started (every 10s).')
}
