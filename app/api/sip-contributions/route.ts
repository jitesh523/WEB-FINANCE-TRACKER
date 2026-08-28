import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sipContributions } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
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
