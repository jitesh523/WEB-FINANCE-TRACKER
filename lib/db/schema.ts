import { pgTable, text, timestamp, boolean, numeric, serial, integer, date } from 'drizzle-orm/pg-core'

// --- better-auth's own tables (standard shape it expects from the Drizzle adapter) ---

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  issuer: text('issuer'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// --- app data, owned by this project ---

export const salary = pgTable('salary', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  amount: numeric('amount').notNull(),
  effectiveMonth: text('effective_month').notNull(), // 'YYYY-MM'
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category').notNull(),
  amount: numeric('amount').notNull(),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// `fundSource`: 'salary' means this deposit was moved out of the salary
// account (and should reduce its balance); 'outside' means it came from
// somewhere else (a gift, cash, etc.) and leaves the salary account untouched.
export const savings = pgTable('savings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  amount: numeric('amount').notNull(),
  note: text('note'),
  fundSource: text('fund_source').notNull().default('outside'),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// `destination`: which account this income should be credited to.
export const income = pgTable('income', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  amount: numeric('amount').notNull(),
  source: text('source'),
  destination: text('destination').notNull().default('salary'),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// A recurring SIP (Systematic Investment Plan): which day of the month it's
// due, how much, and which account it's cut from. On or after that day each
// month, it's automatically "executed" once (see /api/sip) — the amount is
// deducted from fromAccount and credited into the SIP account, exactly like
// an internal Transfer, just triggered by the date instead of a click.
// `lastExecutedMonth` ('YYYY-MM') stops it from firing twice in one month.
export const sipPlans = pgTable('sip_plans', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: numeric('amount').notNull(),
  dayOfMonth: integer('day_of_month').notNull(),
  fromAccount: text('from_account').notNull().default('salary'),
  lastExecutedMonth: text('last_executed_month'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// One row per executed SIP contribution — the ledger backing the SIP
// account's balance for a given month. `sipId` is nullable and set to null
// (not cascade-deleted) if the plan is later removed, so deleting a plan
// stops future reminders/executions without erasing money that already moved.
export const sipContributions = pgTable('sip_contributions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sipId: integer('sip_id').references(() => sipPlans.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  amount: numeric('amount').notNull(),
  fromAccount: text('from_account').notNull(),
  month: text('month').notNull(),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
