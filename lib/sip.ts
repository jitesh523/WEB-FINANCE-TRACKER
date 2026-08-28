import { db } from '@/lib/db'
import { expenses, savings } from '@/lib/db/schema'

// Moves money out of a source account for a SIP contribution — shared by the
// automatic date-triggered execution and manual contribution logging, so both
// paths affect account balances identically. `fromAccount === 'none'` means no
// account is deducted (e.g. backfilling a payment made before this app tracked it).
export async function deductForSip(
  userId: string,
  params: { name: string; amount: number; date: string; fromAccount: string }
) {
  const { name, amount, date, fromAccount } = params
  if (fromAccount === 'savings') {
    await db.insert(savings).values({
      userId,
      amount: String(-amount),
      note: `SIP: ${name}`,
      fundSource: 'outside',
      date,
    })
  } else if (fromAccount === 'salary') {
    await db.insert(expenses).values({
      userId,
      title: name,
      category: 'SIP',
      amount: String(amount),
      date,
    })
  }
}
