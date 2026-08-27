import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { income } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
import { and, eq, gte, lte, desc } from 'drizzle-orm'

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = new Date(y, m, 0).toISOString().slice(0, 10)
  return { start, end }
}

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
  const { amount, source, date } = body
  if (!amount || !date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [row] = await db
    .insert(income)
    .values({ userId, amount: String(amount), source: source || null, date })
    .returning()

  return NextResponse.json({ income: row })
}
