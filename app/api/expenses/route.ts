import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { expenses } from '@/lib/db/schema'
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
    .from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, start), lte(expenses.date, end)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt))

  return NextResponse.json({ expenses: rows })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, category, amount, date } = body
  if (!title || !category || !amount || !date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [row] = await db
    .insert(expenses)
    .values({ userId, title, category, amount: String(amount), date })
    .returning()

  return NextResponse.json({ expense: row })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.delete(expenses).where(and(eq(expenses.id, Number(id)), eq(expenses.userId, userId)))
  return NextResponse.json({ ok: true })
}
