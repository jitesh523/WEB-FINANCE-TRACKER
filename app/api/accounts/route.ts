import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/get-session'
import { creditDueSalaryMonths, getAccountBalances } from '@/lib/accounts'

// Real-money account balances (Salary, Savings) — cumulative all-time, not
// scoped to whichever month is being viewed. Also backfills any monthly
// salary credit that's come due since the last check, same idea as the SIP
// auto-execution in /api/sip.
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await creditDueSalaryMonths(userId)
  const balances = await getAccountBalances(userId)
  return NextResponse.json(balances)
}
