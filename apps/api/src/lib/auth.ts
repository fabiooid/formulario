import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { passwordRejection, type PasswordRejection } from '@formulario/domain'
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
  mustChangePassword: boolean
}

export type PasswordErrorCode = PasswordRejection | 'wrong_current' | 'same'

export class PasswordError extends Error {
  code: PasswordErrorCode
  constructor(code: PasswordErrorCode) {
    super(code)
    this.code = code
  }
}

export class AccountExistsError extends Error {
  constructor() {
    super('An account with this email already exists')
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function assertPasswordAllowed(password: string, email: string) {
  const rejection = passwordRejection(password, email)
  if (rejection) throw new PasswordError(rejection)
}

export async function createProvisionedUser(
  email: string,
  password: string,
  plan: 'free' | 'paid' = 'free',
) {
  const normalized = normalizeEmail(email)
  assertPasswordAllowed(password, normalized)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)
  try {
    await db.insert(users).values({
      id,
      email: normalized,
      passwordHash,
      plan,
      mustChangePassword: true,
      createdAt: now,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.toLowerCase().includes('unique')) throw new AccountExistsError()
    throw error
  }
  const personal = await ensurePersonalOrganization(id)
  return {
    id,
    email: normalized,
    plan,
    activeOrganizationId: personal.id,
    mustChangePassword: true,
  }
}

export async function replaceTemporaryPassword(email: string, password: string) {
  const normalized = normalizeEmail(email)
  assertPasswordAllowed(password, normalized)
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1)
  if (!user) return null
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: true })
    .where(eq(users.id, user.id))
  return toAuthUser({ ...user, mustChangePassword: true })
}

export async function changePassword(userId: string, newPassword: string, currentPassword?: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new PasswordError('wrong_current')
  if (!user.mustChangePassword) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new PasswordError('wrong_current')
    }
  }
  if (await verifyPassword(newPassword, user.passwordHash)) throw new PasswordError('same')
  assertPasswordAllowed(newPassword, user.email)
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
    .where(eq(users.id, userId))
  return toAuthUser({ ...user, mustChangePassword: false })
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1)
  if (!user) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return toAuthUser(user)
}

export async function signAppToken(user: Pick<AuthUser, 'id' | 'email' | 'plan'>): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, plan: user.plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

async function toAuthUser(user: typeof users.$inferSelect): Promise<AuthUser> {
  const mustChangePassword = user.mustChangePassword
  if (user.activeOrganizationId) {
    return {
      id: user.id,
      email: user.email,
      plan: user.plan as 'free' | 'paid',
      activeOrganizationId: user.activeOrganizationId,
      mustChangePassword,
    }
  }
  const personal = await ensurePersonalOrganization(user.id)
  return {
    id: user.id,
    email: user.email,
    plan: user.plan as 'free' | 'paid',
    activeOrganizationId: personal.id,
    mustChangePassword,
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
