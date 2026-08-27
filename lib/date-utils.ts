// Always use the browser/server's LOCAL calendar date, never toISOString()
// (which converts to UTC and silently shifts the date for anyone in a
// positive UTC-offset timezone, e.g. IST users see a UTC date that's still
// "yesterday" until 5:30am local time).
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toLocalISODate(new Date())
}

export function currentMonthISO(): string {
  return todayISO().slice(0, 7)
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = toLocalISODate(new Date(y, m, 0))
  return { start, end }
}
