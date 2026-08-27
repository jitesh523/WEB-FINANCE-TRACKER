import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { savings } from '@/lib/db/schema'
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
    .from(savings)
    .where(and(eq(savings.userId, userId), gte(savings.date, start), lte(savings.date, end)))
    .orderBy(desc(savings.date), desc(savings.createdAt))

  return NextResponse.json({ savings: rows })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount, note, date, fundSource } = body
  if (!amount || !date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (fundSource && fundSource !== 'outside' && fundSource !== 'salary') {
    return NextResponse.json({ error: 'Invalid fundSource' }, { status: 400 })
  }

  const [row] = await db
    .insert(savings)
    .values({ userId, amount: String(amount), note: note || null, fundSource: fundSource || 'outside', date })
    .returning()

  return NextResponse.json({ saving: row })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.delete(savings).where(and(eq(savings.id, Number(id)), eq(savings.userId, userId)))
  return NextResponse.json({ ok: true })
}
