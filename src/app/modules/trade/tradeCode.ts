import { Schema, model } from 'mongoose'

/**
 * Human trade numbers, per the client: A-01, A-02 … A-1000, then B-01 …
 * B-1000, then C-01 and so on. Numbers are at least two digits.
 *
 * One atomic counter document hands out the sequence, so two trades accepted
 * at the same moment never get the same number.
 */

const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

export const Counter = model<{ _id: string; seq: number }>(
  'Counter',
  CounterSchema,
)

export const PER_LETTER = 1000

const letterFor = (index: number): string => {
  // 0 → A … 25 → Z, 26 → AA, 27 → AB …
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** seq 1 → A-01, 1000 → A-1000, 1001 → B-01. */
export const formatTradeCode = (seq: number): string => {
  const zeroBased = seq - 1
  const letter = letterFor(Math.floor(zeroBased / PER_LETTER))
  const number = (zeroBased % PER_LETTER) + 1
  return `${letter}-${String(number).padStart(2, '0')}`
}

export const nextTradeCode = async (): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'tradeCode' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return formatTradeCode(counter!.seq)
}
