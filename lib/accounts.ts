import { db } from '@/lib/db'
import { salary, salaryCredits, income, expenses, savings } from '@/lib/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'
import { currentMonthISO, todayISO } from '@/lib/date-utils'

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1) // mo is 1-indexed, so this lands on the 1st of next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Clamps a day-of-month into a real calendar date for that month (e.g. pay
// day 31 in a 30-day month lands on the 30th).
function dateInMonth(month: string, day: number): string {
  const [y, mo] = month.split('-').map(Number)
  const lastDay = new Date(y, mo, 0).getDate()
  const d = Math.min(Math.max(day, 1), lastDay)
  return `${month}-${String(d).padStart(2, '0')}`
}

async function salaryRows(userId: string) {
  return db.select().from(salary).where(eq(salary.userId, userId)).orderBy(salary.effectiveMonth, salary.createdAt)
}

// The rate + pay day effective as of a given month — whichever was most
// recently set on or before that month ("carries forward" so it doesn't need
// re-entry every month).
function configAsOf(rows: Awaited<ReturnType<typeof salaryRows>>, asOfMonth: string) {
  if (rows.length === 0) return { rate: 0, payDay: 1 }
  let rate = rows[0].amount
  let payDay = rows[0].payDay
  for (const r of rows) {
    if (r.effectiveMonth <= asOfMonth) {
      rate = r.amount
      payDay = r.payDay
    } else break
  }
  return { rate: Number(rate), payDay }
}

// Salary is set once and "carries forward" as a rate + pay day, but a real
// salary account gets paid fresh every month. This ensures a salary_credits
// row exists for every month from the rate's earliest effective month
// through the current month — crediting on the configured pay day, and only
// once that day has actually arrived for the current month — so account
// balances properly accumulate month to month instead of resetting.
export async function creditDueSalaryMonths(userId: string) {
  const rows = await salaryRows(userId)
  if (rows.length === 0) return

  const current = currentMonthISO()
  const todayNum = Number(todayISO().slice(8, 10))
  const existing = await db.select({ month: salaryCredits.month }).from(salaryCredits).where(eq(salaryCredits.userId, userId))
  const creditedMonths = new Set(existing.map((r) => r.month))

  let m = rows[0].effectiveMonth
  while (m <= current) {
    if (!creditedMonths.has(m)) {
      const { rate, payDay } = configAsOf(rows, m)
      const due = m < current || todayNum >= payDay
      if (due) {
        await db.insert(salaryCredits).values({ userId, amount: String(rate), month: m, date: dateInMonth(m, payDay) })
      }
    }
    m = nextMonth(m)
  }
}

// Real, cumulative (all-time) account balances — money doesn't vanish when a
// new month starts. Per-month figures (this month's spending, category
// breakdowns, etc.) stay separately computed and month-scoped elsewhere.
export async function getAccountBalances(userId: string) {
  const rows = await salaryRows(userId)
  const { rate: currentRate, payDay: currentPayDay } = configAsOf(rows, currentMonthISO())

  const [[creditedRow], [incSalaryRow], [incSavingsRow], [spentRow], [savFromSalaryRow], [savAllRow]] = await Promise.all([
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
    salaryPayDay: currentPayDay,
    salaryAccountBalance,
    savingsAccountBalance,
    totalCreditedToSalary,
    totalAvailableIncome,
  }
}
