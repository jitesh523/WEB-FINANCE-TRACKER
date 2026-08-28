import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sipPlans, sipContributions, expenses, savings } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
import { currentMonthISO, todayISO } from '@/lib/date-utils'
import { and, eq, sql } from 'drizzle-orm'

async function getTotalContributed(userId: string) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${sipContributions.amount}), 0)` })
    .from(sipContributions)
    .where(eq(sipContributions.userId, userId))
  return Number(row?.total || 0)
}

// Runs whenever the SIP list is fetched (i.e. on every dashboard load).
// For each plan whose day has arrived and hasn't fired this month yet,
// deducts the amount from its source account and credits it into the SIP
// account — the same mechanism as a manual Transfer, just date-triggered.
async function executeDuePlans(userId: string) {
  const month = currentMonthISO()
  const today = todayISO()
  const todayNum = Number(today.slice(8, 10))

  const plans = await db.select().from(sipPlans).where(eq(sipPlans.userId, userId))
  const executed: string[] = []

  for (const plan of plans) {
    if (plan.dayOfMonth > todayNum || plan.lastExecutedMonth === month) continue

    if (plan.fromAccount === 'savings') {
      await db.insert(savings).values({
        userId,
        amount: String(-Number(plan.amount)),
        note: `SIP: ${plan.name}`,
        fundSource: 'outside',
        date: today,
      })
    } else {
      await db.insert(expenses).values({
        userId,
        title: plan.name,
        category: 'SIP',
        amount: String(plan.amount),
        date: today,
      })
    }

    await db.insert(sipContributions).values({
      userId,
      sipId: plan.id,
      name: plan.name,
      amount: String(plan.amount),
      fromAccount: plan.fromAccount,
      month,
      date: today,
    })

    await db.update(sipPlans).set({ lastExecutedMonth: month }).where(eq(sipPlans.id, plan.id))
    plan.lastExecutedMonth = month
    executed.push(plan.name)
  }

  return { plans, executed }
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plans, executed } = await executeDuePlans(userId)
  const totalContributed = await getTotalContributed(userId)
  return NextResponse.json({
    sips: plans.map((p) => ({ ...p, amount: Number(p.amount) })),
    executed,
    totalContributed,
  })
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
