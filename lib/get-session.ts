import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return null
  }
  return session.user.id
}
