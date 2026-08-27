import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { income } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
import { monthRange } from '@/lib/date-utils'
import { and, eq, gte, lte, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 })
  const { start, end } = monthRange(month)

  const rows = await db
    .select()
    .from(income)
    .where(and(eq(income.userId, userId), gte(income.date, start), lte(income.date, end)))
    .orderBy(desc(income.date), desc(income.createdAt))

  return NextResponse.json({ income: rows })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount, source, date, destination } = body
  if (!amount || !date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (destination && destination !== 'salary' && destination !== 'savings') {
    return NextResponse.json({ error: 'Invalid destination' }, { status: 400 })
  }

  const [row] = await db
    .insert(income)
    .values({ userId, amount: String(amount), source: source || null, destination: destination || 'salary', date })
    .returning()

  return NextResponse.json({ income: row })
}
