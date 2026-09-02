import { db } from '@/lib/db'
import { salary, salaryCredits, income, expenses, savings } from '@/lib/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'
import { currentMonthISO } from '@/lib/date-utils'

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1) // mo is 1-indexed, so this lands on the 1st of next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function currentSalaryRate(userId: string, asOfMonth: string) {
  const rows = await db.select().from(salary).where(eq(salary.userId, userId)).orderBy(salary.effectiveMonth, salary.createdAt)
  if (rows.length === 0) return 0
  let rate = rows[0].amount
  for (const r of rows) {
    if (r.effectiveMonth <= asOfMonth) rate = r.amount
    else break
  }
  return Number(rate)
}

// Salary is set once and "carries forward" as a rate, but a real salary
// account gets paid fresh every month. This ensures a salary_credits row
// exists for every month from the rate's earliest effective month through
// the current month, so account balances properly accumulate month to month
// instead of resetting when a new month starts.
export async function creditDueSalaryMonths(userId: string) {
  const rows = await db
    .select()
    .from(salary)
    .where(eq(salary.userId, userId))
    .orderBy(salary.effectiveMonth, salary.createdAt)
  if (rows.length === 0) return

  const current = currentMonthISO()
  const existing = await db.select({ month: salaryCredits.month }).from(salaryCredits).where(eq(salaryCredits.userId, userId))
  const creditedMonths = new Set(existing.map((r) => r.month))

  let m = rows[0].effectiveMonth
  while (m <= current) {
    if (!creditedMonths.has(m)) {
      const rate = await currentSalaryRate(userId, m)
      await db.insert(salaryCredits).values({ userId, amount: String(rate), month: m, date: `${m}-01` })
    }
    m = nextMonth(m)
  }
}

// Real, cumulative (all-time) account balances — money doesn't vanish when a
// new month starts. Per-month figures (this month's spending, category
// breakdowns, etc.) stay separately computed and month-scoped elsewhere.
export async function getAccountBalances(userId: string) {
  const [[creditedRow], [incSalaryRow], [incSavingsRow], [spentRow], [savFromSalaryRow], [savAllRow], currentRate] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${salaryCredits.amount}), 0)` })
      .from(salaryCredits)
      .where(eq(salaryCredits.userId, userId)),
    db
      .select({ total: sql<string>`coalesce(sum(${income.amount}), 0)` })
      .from(income)
      .where(and(eq(income.userId, userId), ne(income.destination, 'savings'))),
    db
      .select({ total: sql<string>`coalesce(sum(${income.amount}), 0)` })
      .from(income)
      .where(and(eq(income.userId, userId), eq(income.destination, 'savings'))),
    db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(eq(expenses.userId, userId)),
    db
      .select({ total: sql<string>`coalesce(sum(${savings.amount}), 0)` })
      .from(savings)
      .where(and(eq(savings.userId, userId), eq(savings.fundSource, 'salary'))),
    db
      .select({ total: sql<string>`coalesce(sum(${savings.amount}), 0)` })
      .from(savings)
      .where(eq(savings.userId, userId)),
    currentSalaryRate(userId, currentMonthISO()),
  ])

  const salaryCredited = Number(creditedRow?.total || 0)
  const incomeToSalary = Number(incSalaryRow?.total || 0)
  const incomeToSavings = Number(incSavingsRow?.total || 0)
  const totalSpent = Number(spentRow?.total || 0)
  const savingsFromSalary = Number(savFromSalaryRow?.total || 0)
  const totalSaved = Number(savAllRow?.total || 0)

  const salaryAccountBalance = salaryCredited + incomeToSalary - totalSpent - savingsFromSalary
  const savingsAccountBalance = totalSaved + incomeToSavings
  const totalCreditedToSalary = salaryCredited + incomeToSalary
  const totalAvailableIncome = totalCreditedToSalary + incomeToSavings

  return {
    salaryRate: currentRate,
    salaryAccountBalance,
    savingsAccountBalance,
    totalCreditedToSalary,
    totalAvailableIncome,
  }
}
