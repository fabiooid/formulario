import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { ensurePersonalOrganization } from '../services/organizations.js'

const DEV_JWT_SECRET = 'supersecretdevkeythatishs256safe!'
const jwtSecret = process.env.MASTRA_JWT_SECRET ?? DEV_JWT_SECRET

if (jwtSecret === DEV_JWT_SECRET) {
  const message = 'MASTRA_JWT_SECRET is not set (or is the example value). Anyone can forge sign-in tokens.'
  if (process.env.NODE_ENV === 'production') throw new Error(message)
  console.warn(`[formulario] ${message} Fine for local development only.`)
}

const secret = new TextEncoder().encode(jwtSecret)

export interface AuthUser {
  id: string
  email: string
  plan: 'free' | 'paid'
  activeOrganizationId: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createUser(email: string, password: string, plan: 'free' | 'paid' = 'free') {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)
  await db.insert(users).values({ id, email, passwordHash, plan, createdAt: now })
  const personal = await ensurePersonalOrganization(id)
  return { id, email, plan, activeOrganizationId: personal.id }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return toAuthUser(user)
}

export async function signAppToken(user: AuthUser): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, plan: user.plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

async function toAuthUser(user: typeof users.$inferSelect): Promise<AuthUser> {
  if (user.activeOrganizationId) {
    return {
      id: user.id,
      email: user.email,
      plan: user.plan as 'free' | 'paid',
      activeOrganizationId: user.activeOrganizationId,
    }
  }
  const personal = await ensurePersonalOrganization(user.id)
  return {
    id: user.id,
    email: user.email,
    plan: user.plan as 'free' | 'paid',
    activeOrganizationId: personal.id,
  }
}

export async function verifyAppToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub || typeof payload.email !== 'string') return null
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!user) return null
    return toAuthUser(user)
  } catch {
    return null
  }
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) return null
  return toAuthUser(user)
}

export async function updateUserPlan(userId: string, plan: 'free' | 'paid') {
  await db.update(users).set({ plan }).where(eq(users.id, userId))
}
