import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { db } from '@/lib/db'
import { expenses, savings, salary, income } from '@/lib/db/schema'
import { requireUserId } from '@/lib/get-session'
import { monthRange } from '@/lib/date-utils'
import { and, eq, gte, lte, desc } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { month, messages } = await req.json()
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid or missing month (expected YYYY-MM)' }, { status: 400 })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
  }
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Server not configured — missing GROQ_API_KEY' }, { status: 500 })
  }

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

  const savingsRows = await db
    .select()
    .from(savings)
    .where(and(eq(savings.userId, userId), gte(savings.date, start), lte(savings.date, end)))

  const incomeRows = await db
    .select()
    .from(income)
    .where(and(eq(income.userId, userId), gte(income.date, start), lte(income.date, end)))

  const salaryAmount = salaryRow?.amount ? Number(salaryRow.amount) : 0
  const totalSpent = expenseRows.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalSaved = savingsRows.reduce((sum, s) => sum + Number(s.amount), 0)
  const incomeToSalary = incomeRows.filter((i) => i.destination !== 'savings').reduce((sum, i) => sum + Number(i.amount), 0)
  const incomeToSavings = incomeRows.filter((i) => i.destination === 'savings').reduce((sum, i) => sum + Number(i.amount), 0)
  const savingsFromSalary = savingsRows.filter((s) => s.fundSource === 'salary').reduce((sum, s) => sum + Number(s.amount), 0)
  const salaryAccountBalance = salaryAmount + incomeToSalary - totalSpent - savingsFromSalary
  const savingsAccountBalance = totalSaved + incomeToSavings

  const byCategory: Record<string, number> = {}
  for (const e of expenseRows) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
  }
  const categoryLines =
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `- ${cat}: ₹${amt.toFixed(2)}`)
      .join('\n') || '- No expenses logged this month'

  const transactionLines =
    expenseRows
      .slice(0, 30)
      .map((e) => `- ${e.date}: ${e.title} (${e.category}) — ₹${Number(e.amount).toFixed(2)}`)
      .join('\n') || '- No transactions this month'

  const incomeLines =
    incomeRows
      .slice(0, 20)
      .map((i) => `- ${i.date}: ${i.source || 'Extra income'} — ₹${Number(i.amount).toFixed(2)}`)
      .join('\n') || '- No extra income this month'

  const systemPrompt = `You are the AI assistant embedded in DD Finance Calculator, a personal finance tracking app. The user has two separate accounts: a Salary account (their spending money) and a Savings account. Money can be transferred between the two, and income can be routed into either one. Answer the user's questions about their own finances using ONLY the real data below (amounts in Indian Rupees, ₹). Be concise and practical — a few sentences unless asked for more detail. Respond in plain prose only — no markdown formatting (no asterisks, bullet points, headers, or bold text). Never give personalized investment advice (specific stocks, funds, or products) — keep any investment ideas general (e.g. emergency fund, recurring deposit, index funds). If asked something unrelated to their finances, politely redirect to finance topics.

Financial data for ${month}:
Monthly salary credited: ₹${salaryAmount.toFixed(2)}
Income routed to salary account: ₹${incomeToSalary.toFixed(2)}
Income routed to savings account: ₹${incomeToSavings.toFixed(2)}
Total spent: ₹${totalSpent.toFixed(2)}
Net moved from salary into savings: ₹${savingsFromSalary.toFixed(2)}
Salary account balance (available to spend): ₹${salaryAccountBalance.toFixed(2)}
Savings account balance: ₹${savingsAccountBalance.toFixed(2)}

Spending by category:
${categoryLines}

Individual transactions this month:
${transactionLines}

Extra income entries this month:
${incomeLines}`

  const conversation = messages
    .filter((m: { role?: string; content?: string }) => m.role === 'user' || m.role === 'assistant')
    .slice(-12)
    .map((m: { role: 'user' | 'assistant'; content: string }) => ({
      role: m.role,
      content: String(m.content).slice(0, 2000),
    }))

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: systemPrompt }, ...conversation],
      temperature: 0.5,
    })

    const reply = completion.choices[0]?.message?.content?.trim() || 'No response.'
    return NextResponse.json({ reply })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to get a response: ${message}` }, { status: 502 })
  }
}
