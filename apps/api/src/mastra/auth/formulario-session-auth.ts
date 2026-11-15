import { MastraAuthProvider } from '@mastra/core/server'
import type { MastraAuthRequest } from '@mastra/core/server'
import { getRequestHeader } from '@mastra/core/server'
import {
  getUserById,
  verifyAppToken,
  type AuthUser,
} from '../../lib/auth.js'

/**
 * Mastra `server.auth` provider: Formulario session JWTs (same Bearer tokens as the app).
 * Studio opens with `?auth_header=Bearer%20…` per Mastra Studio auth docs.
 */
export class FormularioSessionAuth extends MastraAuthProvider<AuthUser> {
  constructor() {
    super({ name: 'formulario-session' })
  }

  async authenticateToken(token: string, _request: MastraAuthRequest): Promise<AuthUser | null> {
    const user = await verifyAppToken(token)
    if (!user || user.mustChangePassword) return null
    return user
  }

  async authorizeUser(user: AuthUser, _request: MastraAuthRequest): Promise<boolean> {
    return Boolean(user?.id)
  }

  mapUserToResourceId(user: AuthUser) {
    return user.id
  }

  async getCurrentUser(request: Request) {
    const header = getRequestHeader(request, 'authorization')
    if (!header?.startsWith('Bearer ')) return null
    const user = await this.authenticateToken(header.slice(7), request)
    if (!user) return null
    return { id: user.id, email: user.email, name: user.email }
  }

  async getUser(userId: string) {
    const user = await getUserById(userId)
    if (!user || user.mustChangePassword) return null
    return { id: user.id, email: user.email, name: user.email }
  }
}
