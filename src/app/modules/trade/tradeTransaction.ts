import mongoose, { ClientSession } from 'mongoose'

const NO_TRANSACTIONS =
  /Transaction numbers are only allowed on a replica set member or mongos/

/**
 * Runs `work` in a transaction. A standalone MongoDB (local development) has
 * no transactions, so there it runs without one; callers keep their writes
 * safe to repeat for that case.
 */
export const runInTransaction = async <T>(
  work: (session?: ClientSession) => Promise<T>,
): Promise<T> => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()
    const result = await work(session)
    await session.commitTransaction()
    return result
  } catch (err: any) {
    if (session.inTransaction()) await session.abortTransaction().catch(() => {})
    if (NO_TRANSACTIONS.test(err?.message || '')) return work(undefined)
    throw err
  } finally {
    session.endSession()
  }
}
