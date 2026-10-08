/* eslint-disable react-refresh/only-export-components -- provider + hook live together, like the other providers */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken, type AuthUser } from './api'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  changePassword: (input: { currentPassword?: string; newPassword: string }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  // Only wait on the network when there is a stored token to check.
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  const refreshUser = async () => {
    if (!getToken()) {
      setUser(null)
      return
    }
    try {
      const { user: next } = await api.me()
      setUser(next)
    } catch (error) {
      // An expired or invalid token should not linger in storage.
      setToken(null)
      setUser(null)
      throw error
    }
  }

  useEffect(() => {
    if (!getToken()) return
    let cancelled = false
    api
      .me()
      .then(({ user: next }) => {
        if (!cancelled) setUser(next)
      })
      .catch(() => {
        setToken(null)
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const { user: next, token } = await api.login(email, password)
        setToken(token)
        setUser(next)
      },
      changePassword: async (input) => {
        const { user: next } = await api.changePassword(input)
        setUser(next)
      },
      logout: () => {
        setToken(null)
        setUser(null)
      },
      refreshUser,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
