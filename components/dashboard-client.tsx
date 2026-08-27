'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { ThemeToggle } from '@/components/theme-toggle'
import { todayISO, toLocalISODate } from '@/lib/date-utils'

type Expense = { id: number; title: string; category: string; amount: number; date: string }
type Saving = { id: number; amount: number; note: string | null; fundSource: string; date: string }
type IncomeEntry = { id: number; amount: number; source: string | null; destination: string; date: string }

const CATEGORY_META: Record<string, { color: string; icon: string }> = {
  'Food & Dining': { color: 'bg-chart-1', icon: '🍜' },
  Housing: { color: 'bg-chart-2', icon: '⌂' },
  Transport: { color: 'bg-chart-3', icon: '↗' },
  Shopping: { color: 'bg-chart-4', icon: '▦' },
}
const DEFAULT_META = { color: 'bg-chart-5', icon: '•' }
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  const today = todayISO()
  const yesterday = toLocalISODate(new Date(Date.now() - 86400000))
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export function DashboardClient({
  userName,
  month,
  initialSalary,
  initialExpenses,
  initialSavings,
  initialIncome,
}: {
  userName: string
  month: string
  initialSalary: number
  initialExpenses: Expense[]
  initialSavings: Saving[]
  initialIncome: IncomeEntry[]
}) {
  const router = useRouter()
  const [expenses, setExpenses] = useState(initialExpenses)
  const [savingsEntries, setSavingsEntries] = useState(initialSavings)
  const [incomeEntries, setIncomeEntries] = useState(initialIncome)
  const [salaryAmount, setSalaryAmount] = useState(initialSalary)

  const [viewMonth, setViewMonth] = useState(month)
  const [monthMenuOpen, setMonthMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [monthLoading, setMonthLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const isCurrentMonth = viewMonth === month

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddSalary, setShowAddSalary] = useState(false)
  const [showAddSavings, setShowAddSavings] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'Food & Dining', date: todayISO() })
  const [salaryForm, setSalaryForm] = useState(String(initialSalary || ''))
  const [savingsForm, setSavingsForm] = useState({ amount: '', note: '', fundSource: 'outside', date: todayISO() })
  const [incomeForm, setIncomeForm] = useState({ amount: '', source: '', destination: 'salary', date: todayISO() })
  const [transferForm, setTransferForm] = useState<{
    amount: string
    direction: 'salary_to_savings' | 'savings_to_salary'
    date: string
  }>({ amount: '', direction: 'salary_to_savings', date: todayISO() })

  type ChatMessage = { role: 'user' | 'assistant'; content: string }
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])
  const totalSaved = useMemo(() => savingsEntries.reduce((s, x) => s + x.amount, 0), [savingsEntries])
  const incomeToSalary = useMemo(
    () => incomeEntries.filter((i) => i.destination !== 'savings').reduce((s, i) => s + i.amount, 0),
    [incomeEntries],
  )
  const incomeToSavings = useMemo(
    () => incomeEntries.filter((i) => i.destination === 'savings').reduce((s, i) => s + i.amount, 0),
    [incomeEntries],
  )
  const savingsFromSalary = useMemo(
    () => savingsEntries.filter((x) => x.fundSource === 'salary').reduce((s, x) => s + x.amount, 0),
    [savingsEntries],
  )
  const totalIncome = incomeToSalary + incomeToSavings
  const totalAvailableIncome = salaryAmount + totalIncome

  // Two real account balances: money moved from Salary into Savings leaves the
  // salary balance and lands in the savings balance; money added "from outside"
  // only ever touches the savings balance.
  const salaryAccountBalance = salaryAmount + incomeToSalary - totalSpent - savingsFromSalary
  const savingsAccountBalance = totalSaved + incomeToSavings
  const savingsRate = totalAvailableIncome > 0 ? (savingsAccountBalance / totalAvailableIncome) * 100 : 0

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) map[e.category] = (map[e.category] || 0) + e.amount
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenses])

  const dailyBars = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const totals = new Array(daysInMonth).fill(0)
    for (const e of expenses) {
      const day = Number(e.date.slice(8, 10))
      if (day >= 1 && day <= daysInMonth) totals[day - 1] += e.amount
    }
    const max = Math.max(1, ...totals)
    const todayNum = new Date().getDate()
    return totals.map((v, i) => ({
      height: Math.max(4, Math.round((v / max) * 100)),
      isToday: isCurrentMonth && i + 1 === todayNum,
    }))
  }, [expenses, viewMonth, isCurrentMonth])

  const monthOptions = useMemo(() => {
    const [cy, cm] = month.split('-').map(Number)
    const opts: { value: string; label: string }[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(cy, cm - 1 - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      opts.push({ value, label: `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` })
    }
    return opts
  }, [month])

  const selectedDayLabel = useMemo(() => {
    if (selectedDay == null) return ''
    const [y, m] = viewMonth.split('-').map(Number)
    const d = new Date(y, m - 1, selectedDay)
    return d.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })
  }, [selectedDay, viewMonth])

  const selectedDayExpenses = useMemo(() => {
    if (selectedDay == null) return []
    return expenses.filter((e) => Number(e.date.slice(8, 10)) === selectedDay)
  }, [selectedDay, expenses])

  const loadMonth = async (m: string) => {
    setMonthLoading(true)
    setSelectedDay(null)
    setChatMessages([])
    try {
      const [expRes, savRes, salRes, incRes] = await Promise.all([
        fetch(`/api/expenses?month=${m}`),
        fetch(`/api/savings?month=${m}`),
        fetch(`/api/salary?month=${m}`),
        fetch(`/api/income?month=${m}`),
      ])
      const [expData, savData, salData, incData] = await Promise.all([
        expRes.json(),
        savRes.json(),
        salRes.json(),
        incRes.json(),
      ])
      setExpenses((expData.expenses || []).map((e: Expense) => ({ ...e, amount: Number(e.amount) })))
      setSavingsEntries((savData.savings || []).map((s: Saving) => ({ ...s, amount: Number(s.amount) })))
      setIncomeEntries((incData.income || []).map((i: IncomeEntry) => ({ ...i, amount: Number(i.amount) })))
      setSalaryAmount(Number(salData.salary || 0))
    } finally {
      setMonthLoading(false)
    }
  }

  const selectMonth = (m: string) => {
    setViewMonth(m)
    setMonthMenuOpen(false)
    loadMonth(m)
  }

  const backToCurrentMonth = () => {
    setViewMonth(month)
    loadMonth(month)
  }

  const addExpense = async () => {
    const category = expenseForm.category.trim()
    if (!expenseForm.title || !expenseForm.amount || !category) return
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: expenseForm.title,
        category,
        amount: Number(expenseForm.amount),
        date: expenseForm.date || todayISO(),
      }),
    })
    if (res.ok) {
      const { expense } = await res.json()
      setExpenses([{ ...expense, amount: Number(expense.amount) }, ...expenses])
      setExpenseForm({ title: '', amount: '', category: 'Food & Dining', date: todayISO() })
      setShowAddExpense(false)
    }
  }

  const updateSalary = async () => {
    const amount = Number(salaryForm)
    if (!amount || amount <= 0) return
    const res = await fetch('/api/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, month }),
    })
    if (res.ok) {
      setSalaryAmount(amount)
      setShowAddSalary(false)
    }
  }

  const addSavings = async () => {
    const amount = Number(savingsForm.amount)
    if (!amount || amount <= 0) return
    const res = await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        note: savingsForm.note,
        fundSource: savingsForm.fundSource,
        date: savingsForm.date || todayISO(),
      }),
    })
    if (res.ok) {
      const { saving } = await res.json()
      setSavingsEntries([{ ...saving, amount: Number(saving.amount) }, ...savingsEntries])
      setSavingsForm({ amount: '', note: '', fundSource: 'outside', date: todayISO() })
      setShowAddSavings(false)
    }
  }

  const addIncome = async () => {
    const amount = Number(incomeForm.amount)
    if (!amount || amount <= 0) return
    const res = await fetch('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        source: incomeForm.source,
        destination: incomeForm.destination,
        date: incomeForm.date || todayISO(),
      }),
    })
    if (res.ok) {
      const { income: row } = await res.json()
      setIncomeEntries([{ ...row, amount: Number(row.amount) }, ...incomeEntries])
      setIncomeForm({ amount: '', source: '', destination: 'salary', date: todayISO() })
      setShowAddIncome(false)
    }
  }

  // A transfer is stored as a savings entry: salary→savings is a normal
  // positive deposit with fundSource 'salary'; savings→salary is the same
  // but negative, which correctly subtracts from the savings total while
  // also reducing `savingsFromSalary` (and thus adding back to the salary
  // balance) in the calculations above.
  const addTransfer = async () => {
    const rawAmount = Number(transferForm.amount)
    if (!rawAmount || rawAmount <= 0) return
    const signedAmount = transferForm.direction === 'salary_to_savings' ? rawAmount : -rawAmount
    const note = transferForm.direction === 'salary_to_savings' ? 'Transfer from salary account' : 'Transfer to salary account'
    const res = await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: signedAmount, note, fundSource: 'salary', date: transferForm.date || todayISO() }),
    })
    if (res.ok) {
      const { saving } = await res.json()
      setSavingsEntries([{ ...saving, amount: Number(saving.amount) }, ...savingsEntries])
      setTransferForm({ amount: '', direction: 'salary_to_savings', date: todayISO() })
      setShowTransfer(false)
    }
  }

  const sendChatMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || chatLoading) return
    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: trimmed }]
    setChatMessages(nextMessages)
    setChatInput('')
    setChatLoading(true)
    setChatError('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: viewMonth, messages: nextMessages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get a response')
      setChatMessages([...nextMessages, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setChatLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const monthLabel = new Date(viewMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const entryDateMin = `${month}-01`
  const entryDateMax = todayISO()
  const initials = userName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar px-5 py-7 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <WalletCards data-icon="inline-start" />
          </div>
          <span className="text-lg font-semibold tracking-tight">DD Finance</span>
        </div>
        <div className="mt-12 flex flex-col gap-2">
          <p className="px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Workspace</p>
          <a
            href="#top"
            className="mt-2 flex items-center gap-3 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <LayoutDashboard data-icon="inline-start" />
            Overview
          </a>
          <a
            href="#expenses"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <WalletCards data-icon="inline-start" />
            Expenses
          </a>
          <a
            href="#insights"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <Sparkles data-icon="inline-start" />
            Insights
          </a>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
            <Settings2 data-icon="inline-start" />
            Settings
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <LogOut data-icon="inline-start" />
            Log out
          </button>
          <div className="mt-4 flex items-center gap-3 border-t pt-5">
            <div className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">Personal plan</p>
            </div>
          </div>
        </div>
      </aside>

      <section id="top" className="lg:pl-64">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5 md:px-10">
          <div>
            <p className="text-sm text-muted-foreground">{todayLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {greeting}, {userName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button aria-label="Notifications" className="rounded-lg border p-2.5 text-muted-foreground">
              <Bell />
            </button>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="rounded-lg border p-2.5 text-muted-foreground lg:hidden"
            >
              <LogOut className="size-4" />
            </button>
            {isCurrentMonth ? (
              <>
                <button
                  onClick={() => setShowAddSalary(true)}
                  className="hidden items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium lg:flex"
                >
                  Set salary
                </button>
                <button
                  onClick={() => setShowAddIncome(true)}
                  className="hidden items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium lg:flex"
                >
                  Add income
                </button>
                <button
                  onClick={() => setShowAddSavings(true)}
                  className="hidden items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium lg:flex"
                >
                  Add savings
                </button>
                <button
                  onClick={() => setShowTransfer(true)}
                  className="hidden items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium lg:flex"
                >
                  Transfer
                </button>

                <div className="relative lg:hidden">
                  <button
                    onClick={() => setMoreMenuOpen((v) => !v)}
                    aria-label="More actions"
                    className="rounded-lg border p-2.5 text-muted-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border bg-card py-1 shadow-lg">
                      <button
                        onClick={() => {
                          setShowAddSalary(true)
                          setMoreMenuOpen(false)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        Set salary
                      </button>
                      <button
                        onClick={() => {
                          setShowAddIncome(true)
                          setMoreMenuOpen(false)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        Add income
                      </button>
                      <button
                        onClick={() => {
                          setShowAddSavings(true)
                          setMoreMenuOpen(false)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        Add savings
                      </button>
                      <button
                        onClick={() => {
                          setShowTransfer(true)
                          setMoreMenuOpen(false)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        Transfer
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowAddExpense(true)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  <Plus />
                  Add expense
                </button>
              </>
            ) : (
              <button
                onClick={backToCurrentMonth}
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium"
              >
                Back to current month
              </button>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Your financial snapshot</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {monthLabel}
                {monthLoading ? ' · Loading…' : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Salary account"
              value={money(salaryAccountBalance)}
              detail={`of ${money(salaryAmount + incomeToSalary)} credited`}
              tone="positive"
            />
            <Metric
              label="Total expenses"
              value={money(totalSpent)}
              detail={`${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`}
              tone="neutral"
            />
            <Metric
              label="Savings account"
              value={money(savingsAccountBalance)}
              detail={`${savingsEntries.length + incomeEntries.filter((i) => i.destination === 'savings').length} deposit${
                savingsEntries.length + incomeEntries.filter((i) => i.destination === 'savings').length === 1 ? '' : 's'
              }`}
              tone="neutral"
            />
            <Metric
              label="Savings rate"
              value={totalAvailableIncome > 0 ? `${savingsRate.toFixed(1)}%` : '—'}
              detail={`of ${money(totalAvailableIncome)} total income`}
              tone="accent"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="font-semibold">Spending overview</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Click a bar to see that day&apos;s transactions</p>
                </div>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setMonthMenuOpen((v) => !v)}
                    className="flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    {monthOptions.find((o) => o.value === viewMonth)?.label || viewMonth}
                    <ChevronDown className="size-3.5" />
                  </button>
                  {monthMenuOpen && (
                    <div className="absolute right-0 z-10 mt-1 max-h-64 w-32 overflow-y-auto rounded-lg border bg-card py-1 shadow-lg">
                      {monthOptions.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => selectMonth(o.value)}
                          className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-muted ${
                            o.value === viewMonth ? 'font-semibold text-primary' : ''
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-8 flex items-stretch gap-1 md:gap-1.5" style={{ height: 190 }}>
                {dailyBars.map((bar, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(selectedDay === i + 1 ? null : i + 1)}
                    className="flex flex-1 cursor-pointer flex-col items-center justify-end gap-2"
                  >
                    <div
                      className={`w-full rounded-t-sm transition-colors ${
                        selectedDay === i + 1 ? 'bg-chart-3' : bar.isToday ? 'bg-primary' : 'bg-accent'
                      }`}
                      style={{ height: `${bar.height}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>Day 1</span>
                <span>Day {Math.ceil(dailyBars.length / 2)}</span>
                <span>Day {dailyBars.length}</span>
              </div>

              {selectedDay !== null && (
                <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{selectedDayLabel}</p>
                    <button aria-label="Close" onClick={() => setSelectedDay(null)}>
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {selectedDayExpenses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No transactions this day.</p>
                    ) : (
                      selectedDayExpenses.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-sm">
                          <span>
                            {(CATEGORY_META[e.category] || DEFAULT_META).icon} {e.title}{' '}
                            <span className="text-muted-foreground">· {e.category}</span>
                          </span>
                          <span className="font-medium">{money(e.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div id="insights" className="flex scroll-mt-6 flex-col rounded-xl border bg-primary p-6 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <Sparkles />
                </div>
                <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs">AI insight</span>
              </div>

              <div className="mt-4 flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: 220, minHeight: 80 }}>
                {chatMessages.length === 0 && !chatLoading && (
                  <p className="text-sm leading-relaxed text-primary-foreground/80">
                    Ask me anything about {monthLabel} — e.g. &ldquo;Where am I overspending?&rdquo; or &ldquo;How&apos;s
                    my savings rate?&rdquo;
                  </p>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                    <p
                      className={
                        m.role === 'user'
                          ? 'inline-block rounded-lg bg-primary-foreground/15 px-3 py-2 text-left text-sm'
                          : 'text-sm leading-relaxed'
                      }
                    >
                      {m.content}
                    </p>
                  </div>
                ))}
                {chatLoading && <p className="text-sm text-primary-foreground/70">Thinking…</p>}
              </div>

              {chatError && <p className="mt-2 text-sm text-primary-foreground/70">{chatError}</p>}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendChatMessage(chatInput)
                }}
                className="mt-4 flex items-center gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your finances…"
                  className="flex-1 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/50 outline-none focus:border-primary-foreground/50"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  aria-label="Send"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15 disabled:opacity-50"
                >
                  <ArrowUpRight />
                </button>
              </form>

              <p className="mt-3 text-[11px] text-primary-foreground/50">Educational guidance only. Not financial advice.</p>
            </div>
          </div>

          <div id="expenses" className="mt-6 grid scroll-mt-6 gap-6 xl:grid-cols-[1fr_1.4fr]">
            <div className="rounded-xl border bg-card p-6">
              <h2 className="font-semibold">Where your money goes</h2>
              <p className="mt-1 text-sm text-muted-foreground">{money(totalSpent)} spent in {monthLabel}</p>
              {totalSpent > 0 ? (
                <>
                  <div className="mt-6 flex h-3 overflow-hidden rounded-full">
                    {byCategory.map(([cat, amt]) => (
                      <div
                        key={cat}
                        className={(CATEGORY_META[cat] || DEFAULT_META).color}
                        style={{ width: `${(amt / totalSpent) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col gap-4">
                    {byCategory.map(([cat, amt]) => (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                          {(CATEGORY_META[cat] || DEFAULT_META).icon}
                        </span>
                        <span className="flex-1 text-sm">{cat}</span>
                        <span className="text-sm font-medium">{money(amt)}</span>
                        <span className="w-10 text-right text-xs text-muted-foreground">
                          {Math.round((amt / totalSpent) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-8 text-sm text-muted-foreground">No expenses logged this month.</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{isCurrentMonth ? 'Recent transactions' : `${monthLabel} statement`}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isCurrentMonth
                      ? 'Your latest activity'
                      : `${expenses.length} transaction${expenses.length === 1 ? '' : 's'} this month`}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col">
                {expenses.length === 0 && (
                  <p className="py-6 text-sm text-muted-foreground">
                    {isCurrentMonth ? 'No expenses yet — add your first one above.' : 'No expenses logged this month.'}
                  </p>
                )}
                {(isCurrentMonth ? expenses.slice(0, 6) : expenses).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 border-t py-4 first:border-0">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-sm">
                      {(CATEGORY_META[e.category] || DEFAULT_META).icon}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.category} · {formatDate(e.date)}
                      </p>
                    </div>
                    <p className="text-sm font-medium">−{money(e.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {showAddExpense && (
        <Modal title="Add an expense" subtitle="Keep your spending picture up to date." onClose={() => setShowAddExpense(false)}>
          <label className="text-sm font-medium">
            What was it for?
            <input
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Coffee with friends"
            />
          </label>
          <label className="text-sm font-medium">
            Amount
            <input
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value.replace(/[^0-9]/g, '') })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="₹ 0"
              inputMode="numeric"
            />
          </label>
          <label className="text-sm font-medium">
            Category
            <input
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              list="expense-categories"
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Food & Dining, Gym, Pet Care"
            />
            <datalist id="expense-categories">
              {Object.keys(CATEGORY_META).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-medium">
            Date
            <input
              type="date"
              value={expenseForm.date}
              min={entryDateMin}
              max={entryDateMax}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button onClick={addExpense} className="mt-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            Save expense
          </button>
        </Modal>
      )}

      {showAddSalary && (
        <Modal title="Set monthly salary" subtitle="Used to calculate what's available to spend." onClose={() => setShowAddSalary(false)}>
          <label className="text-sm font-medium">
            Monthly salary
            <input
              value={salaryForm}
              onChange={(e) => setSalaryForm(e.target.value.replace(/[^0-9]/g, ''))}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="₹ 0"
              inputMode="numeric"
            />
          </label>
          <button onClick={updateSalary} className="mt-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            Save salary
          </button>
        </Modal>
      )}

      {showAddSavings && (
        <Modal title="Add savings" subtitle="Log money you've set aside this month." onClose={() => setShowAddSavings(false)}>
          <label className="text-sm font-medium">
            Amount
            <input
              value={savingsForm.amount}
              onChange={(e) => setSavingsForm({ ...savingsForm, amount: e.target.value.replace(/[^0-9]/g, '') })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="₹ 0"
              inputMode="numeric"
            />
          </label>
          <label className="text-sm font-medium">
            Note (optional)
            <input
              value={savingsForm.note}
              onChange={(e) => setSavingsForm({ ...savingsForm, note: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. moved to savings account"
            />
          </label>
          <label className="text-sm font-medium">
            Where&apos;s this coming from?
            <div className="mt-2 flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setSavingsForm({ ...savingsForm, fundSource: 'outside' })}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${savingsForm.fundSource === 'outside' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                From outside
              </button>
              <button
                type="button"
                onClick={() => setSavingsForm({ ...savingsForm, fundSource: 'salary' })}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${savingsForm.fundSource === 'salary' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                From salary account
              </button>
            </div>
            {savingsForm.fundSource === 'salary' && (
              <p className="mt-2 text-xs text-muted-foreground">This amount will be deducted from your salary account.</p>
            )}
          </label>
          <label className="text-sm font-medium">
            Date
            <input
              type="date"
              value={savingsForm.date}
              min={entryDateMin}
              max={entryDateMax}
              onChange={(e) => setSavingsForm({ ...savingsForm, date: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button onClick={addSavings} className="mt-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            Save
          </button>
        </Modal>
      )}

      {showAddIncome && (
        <Modal title="Add income" subtitle="Log money you received outside your salary." onClose={() => setShowAddIncome(false)}>
          <label className="text-sm font-medium">
            Amount
            <input
              value={incomeForm.amount}
              onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value.replace(/[^0-9]/g, '') })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="₹ 0"
              inputMode="numeric"
            />
          </label>
          <label className="text-sm font-medium">
            From (optional)
            <input
              value={incomeForm.source}
              onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Dad, freelance project"
            />
          </label>
          <label className="text-sm font-medium">
            Add this to
            <div className="mt-2 flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setIncomeForm({ ...incomeForm, destination: 'salary' })}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${incomeForm.destination === 'salary' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                Salary account
              </button>
              <button
                type="button"
                onClick={() => setIncomeForm({ ...incomeForm, destination: 'savings' })}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${incomeForm.destination === 'savings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                Savings account
              </button>
            </div>
          </label>
          <label className="text-sm font-medium">
            Date
            <input
              type="date"
              value={incomeForm.date}
              min={entryDateMin}
              max={entryDateMax}
              onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button onClick={addIncome} className="mt-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            Save
          </button>
        </Modal>
      )}

      {showTransfer && (
        <Modal
          title="Transfer between accounts"
          subtitle="Move money between your salary and savings accounts."
          onClose={() => setShowTransfer(false)}
        >
          <label className="text-sm font-medium">
            Direction
            <div className="mt-2 flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setTransferForm({ ...transferForm, direction: 'salary_to_savings' })}
                className={`flex-1 rounded-md py-2 text-xs font-medium sm:text-sm ${transferForm.direction === 'salary_to_savings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                Salary → Savings
              </button>
              <button
                type="button"
                onClick={() => setTransferForm({ ...transferForm, direction: 'savings_to_salary' })}
                className={`flex-1 rounded-md py-2 text-xs font-medium sm:text-sm ${transferForm.direction === 'savings_to_salary' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                Savings → Salary
              </button>
            </div>
          </label>
          <label className="text-sm font-medium">
            Amount
            <input
              value={transferForm.amount}
              onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value.replace(/[^0-9]/g, '') })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="₹ 0"
              inputMode="numeric"
            />
          </label>
          <label className="text-sm font-medium">
            Date
            <input
              type="date"
              value={transferForm.date}
              min={entryDateMin}
              max={entryDateMax}
              onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button onClick={addTransfer} className="mt-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
            Transfer
          </button>
        </Modal>
      )}
    </main>
  )
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="mt-6 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  )
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-2 text-xs ${tone === 'positive' ? 'text-chart-3' : 'text-muted-foreground'}`}>{detail}</p>
    </div>
  )
}
