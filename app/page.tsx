import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/get-session'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { expenses, savings, salary, income } from '@/lib/db/schema'
import { and, eq, gte, lte, desc } from 'drizzle-orm'
import { DashboardClient } from '@/components/dashboard-client'

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = new Date(y, m, 0).toISOString().slice(0, 10)
  return { start, end }
}

export default async function Page() {
  const userId = await requireUserId()
  if (!userId) redirect('/login')

  const session = await auth.api.getSession({ headers: await headers() })
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'there'

  const month = new Date().toISOString().slice(0, 7)
  const { start, end } = monthRange(month)

  const [salaryRow] = await db
    .select()
    .from(salary)
    .where(and(eq(salary.userId, userId), lte(salary.effectiveMonth, month)))
    .orderBy(desc(salary.effectiveMonth), desc(salary.createdAt))
    .limit(1)

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, start), lte(expenses.date, end)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt))

  const savingsRows = await db
    .select()
    .from(savings)
    .where(and(eq(savings.userId, userId), gte(savings.date, start), lte(savings.date, end)))
    .orderBy(desc(savings.date))

  const incomeRows = await db
    .select()
    .from(income)
    .where(and(eq(income.userId, userId), gte(income.date, start), lte(income.date, end)))
    .orderBy(desc(income.date))

  return (
    <DashboardClient
      userName={userName}
      month={month}
      initialSalary={salaryRow?.amount ? Number(salaryRow.amount) : 0}
      initialExpenses={expenseRows.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
        date: e.date,
      }))}
      initialSavings={savingsRows.map((s) => ({
        id: s.id,
        amount: Number(s.amount),
        note: s.note,
        date: s.date,
      }))}
      initialIncome={incomeRows.map((i) => ({
        id: i.id,
        amount: Number(i.amount),
        source: i.source,
        date: i.date,
      }))}
    />
  )
}
