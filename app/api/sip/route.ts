import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sipPlans } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
import { and, eq, desc } from 'drizzle-orm'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(sipPlans).where(eq(sipPlans.userId, userId)).orderBy(desc(sipPlans.createdAt))
  return NextResponse.json({ sips: rows })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, amount, dayOfMonth, fromAccount } = body
  if (!name || !amount || !dayOfMonth) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const day = Number(dayOfMonth)
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: 'Day of month must be between 1 and 31' }, { status: 400 })
  }
  if (fromAccount && fromAccount !== 'salary' && fromAccount !== 'savings') {
    return NextResponse.json({ error: 'Invalid fromAccount' }, { status: 400 })
  }

  const [row] = await db
    .insert(sipPlans)
    .values({ userId, name, amount: String(amount), dayOfMonth: day, fromAccount: fromAccount || 'salary' })
    .returning()

  return NextResponse.json({ sip: row })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.delete(sipPlans).where(and(eq(sipPlans.id, Number(id)), eq(sipPlans.userId, userId)))
  return NextResponse.json({ ok: true })
}
