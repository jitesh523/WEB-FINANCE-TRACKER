import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sipContributions, sipPlans } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
import { deductForSip } from '@/lib/sip'
import { and, eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 })

  const rows = await db
    .select()
    .from(sipContributions)
    .where(and(eq(sipContributions.userId, userId), eq(sipContributions.month, month)))
    .orderBy(desc(sipContributions.date), desc(sipContributions.createdAt))

  return NextResponse.json({ contributions: rows })
}

// Manually logs a SIP contribution — for payments already made before this
// app tracked them, or an extra one-off top-up. `fromAccount` is 'salary' or
// 'savings' to also deduct from that account (same effect as an automatic
// execution), or 'none' to just record the contribution without touching
// either account balance (for backfilling old, already-spent money).
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sipId, name, amount, date, fromAccount } = body

  if (!name || !amount || !date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  if (date > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Date cannot be in the future' }, { status: 400 })
  }
  const source = fromAccount === 'salary' || fromAccount === 'savings' ? fromAccount : 'none'

  let linkedSipId: number | null = null
  if (sipId) {
    const [plan] = await db
      .select()
      .from(sipPlans)
      .where(and(eq(sipPlans.id, Number(sipId)), eq(sipPlans.userId, userId)))
    if (plan) linkedSipId = plan.id
  }

  await deductForSip(userId, { name, amount: amt, date, fromAccount: source })

  const [row] = await db
    .insert(sipContributions)
    .values({ userId, sipId: linkedSipId, name, amount: String(amt), fromAccount: source, month: date.slice(0, 7), date })
    .returning()

  return NextResponse.json({ contribution: row })
}
