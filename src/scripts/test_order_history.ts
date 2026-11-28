/**
 * Local check for GET /orders/history.
 *
 *   API=http://localhost:5010 npx ts-node --transpile-only src/scripts/test_order_history.ts
 *
 * Logs in the three local test users (password from backend/.env.testusers,
 * never printed), reads their sales and purchases with every filter, and
 * checks that each row's net and the summaries agree with the rows.
 */
import fs from 'fs'
import path from 'path'

const API = (process.env.API || 'http://localhost:5010') + '/api/v1'
const USERS = [
  'buyer.local@test.areis',
  'seller.local@test.areis',
  'applicant.local@test.areis',
]

const password = (() => {
  const file = fs.readFileSync(path.join(__dirname, '../../.env.testusers'), 'utf8')
  const line = file.split('\n').find(l => l.startsWith('LOCAL_TEST_PASSWORD='))
  if (!line) throw new Error('LOCAL_TEST_PASSWORD missing from .env.testusers')
  return line.slice('LOCAL_TEST_PASSWORD='.length).trim()
})()

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}`)
}
const close = (a: number, b: number) => Math.abs(a - b) < 0.011
const round2 = (n: number) => Math.round(n * 100) / 100

const login = async (email: string): Promise<string> => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body: any = await res.json()
  if (!body?.data?.accessToken) throw new Error(`login failed for ${email}: ${body?.message}`)
  return body.data.accessToken
}

const history = async (token: string, query: string) => {
  const res = await fetch(`${API}/orders/history?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body: any = await res.json()
  return { status: res.status, body }
}

const allRows = async (token: string, role: string, extra = '') => {
  const rows: any[] = []
  let page = 1
  let first: any
  for (;;) {
    const { status, body } = await history(token, `role=${role}&limit=100&page=${page}${extra}`)
    if (status !== 200) throw new Error(`history ${role} ${extra} -> ${status} ${body?.message}`)
    first ??= body.data
    rows.push(...body.data.rows)
    if (page >= body.data.meta.totalPages) break
    page++
  }
  return { data: first, rows }
}

const run = async () => {
  for (const email of USERS) {
    console.log(`\n${email}`)
    const token = await login(email)

    // ── Seller ────────────────────────────────────────────────────────────
    const seller = await allRows(token, 'seller')
    const s = seller.data.summary
    console.log(
      `  seller: ${seller.rows.length} rows, earned $${s.totalEarned}, this month $${s.thisMonth}, ` +
        `in progress $${s.inProgress}, completed $${s.completed}, payout ${JSON.stringify(s.payout)}`,
    )
    for (const r of seller.rows) {
      const expected = r.status === 'refunded' ? 0 : round2(r.itemPrice + r.shipping - r.ariesFee)
      if (!close(r.net, expected)) {
        check(false, `net for ${r.id}: ${r.net} != ${expected}`)
      }
      if (!['buy_now', 'auction_win', 'giveaway', 'trade_cash'].includes(r.kind)) {
        check(false, `unexpected kind ${r.kind}`)
      }
    }
    check(true, `every seller row: net = item + shipping − fee (0 when refunded)`)
    const live = seller.rows.filter(r => r.status !== 'refunded')
    const sumNet = round2(live.reduce((t, r) => t + r.net, 0))
    check(close(s.totalEarned, sumNet), `totalEarned ${s.totalEarned} = sum of nets ${sumNet}`)
    check(
      close(s.inProgress + s.completed, s.totalEarned),
      `inProgress + completed = totalEarned`,
    )
    const paidLive = live.filter(r => r.kind !== 'giveaway').length
    check(s.salesCount === paidLive, `salesCount ${s.salesCount} = ${paidLive}`)
    const dates = seller.rows.map(r => new Date(r.date).getTime())
    check(dates.every((d, i) => i === 0 || dates[i - 1] >= d), 'rows newest first')

    for (const status of ['paid', 'shipped', 'delivered', 'refunded']) {
      const f = await allRows(token, 'seller', `&status=${status}`)
      check(
        f.rows.every(r => r.status === status) &&
          f.rows.length === seller.rows.filter(r => r.status === status).length,
        `status=${status}: ${f.rows.length} rows`,
      )
    }
    for (const period of ['7d', '30d']) {
      const f = await allRows(token, 'seller', `&period=${period}`)
      const since = Date.now() - (period === '7d' ? 7 : 30) * 864e5
      const expected = seller.rows.filter(r => new Date(r.date).getTime() >= since)
      check(f.rows.length === expected.length, `period=${period}: ${f.rows.length} rows`)
      const periodSum = round2(
        expected.filter(r => r.status !== 'refunded').reduce((t, r) => t + r.net, 0),
      )
      check(close(f.data.summary.periodEarned, periodSum), `periodEarned ${period} = ${periodSum}`)
    }

    // ── Buyer ─────────────────────────────────────────────────────────────
    const buyer = await allRows(token, 'buyer')
    const b = buyer.data.summary
    console.log(`  buyer: ${buyer.rows.length} rows, spent $${b.totalSpent}, refunded $${b.refunded}`)
    check(buyer.rows.every(r => r.net === undefined && r.ariesFee === undefined), 'buyer rows hide seller fee/net')
    const spent = round2(
      buyer.rows.filter(r => r.status !== 'refunded').reduce((t, r) => t + r.totalPaid, 0),
    )
    check(close(b.totalSpent, spent), `totalSpent ${b.totalSpent} = ${spent}`)
    const over = buyer.rows.filter(r => r.itemPrice + r.shipping + r.taxes > r.totalPaid + 0.011)
    check(over.length === 0, 'item + shipping + tax never exceeds what was paid')

    // Pagination
    const p1 = await history(token, 'role=buyer&limit=1&page=1')
    check(p1.body.data.rows.length <= 1 && p1.body.data.meta.limit === 1, 'limit=1 pages')
  }

  // ── Validation ──────────────────────────────────────────────────────────
  console.log('\nvalidation')
  const token = await login(USERS[0])
  check((await history(token, 'period=1y')).status === 400, 'bad period -> 400')
  check((await history(token, 'status=lost')).status === 400, 'bad status -> 400')
  const unauth = await fetch(`${API}/orders/history`)
  check(unauth.status === 401, 'no token -> 401')
  const capped = await history(token, 'limit=1000')
  check(capped.body.data.meta.limit === 100, 'limit capped at 100')

  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
