import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { salary } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
import { and, eq, lte, desc } from 'drizzle-orm'

// Salary carries forward: whatever was last set on or before the requested
// month is treated as the current salary, so you don't have to re-enter it
// every month.
export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 })

  const [row] = await db
    .select()
    .from(salary)
    .where(and(eq(salary.userId, userId), lte(salary.effectiveMonth, month)))
    .orderBy(desc(salary.effectiveMonth), desc(salary.createdAt))
    .limit(1)

  return NextResponse.json({ salary: row?.amount ? Number(row.amount) : 0 })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount, month, payDay } = body
  if (amount == null || !month) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const day = payDay == null ? 1 : Number(payDay)
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: 'Pay day must be between 1 and 31' }, { status: 400 })
  }

  const [row] = await db
    .insert(salary)
    .values({ userId, amount: String(amount), payDay: day, effectiveMonth: month })
    .returning()

  return NextResponse.json({ salary: row })
}
