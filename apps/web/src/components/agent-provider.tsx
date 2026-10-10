import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { isSettingsPath, trackSettingsReturnPath } from '@/lib/settings'

const STORAGE_KEY = 'agent-pane-mode'

export type AgentMode = 'closed' | 'pane' | 'full'

export type AgentChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  href?: string
  hrefLabel?: string
}

const MAX_THREAD_TITLE = 48

export function titleFromFirstPrompt(prompt: string) {
  const text = prompt.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= MAX_THREAD_TITLE) return text
  const sliced = text.slice(0, MAX_THREAD_TITLE)
  const lastSpace = sliced.lastIndexOf(' ')
  const base = lastSpace > 16 ? sliced.slice(0, lastSpace) : sliced
  return `${base}…`
}

type AgentContextValue = {
  mode: AgentMode
  open: () => void
  close: () => void
  toggle: () => void
  expand: () => void
  collapseToPane: () => void
  ask: (message: string) => void
  pendingPrompt: string | null
  clearPendingPrompt: () => void
  variantId: string | null
  setVariantId: (value: string | null) => void
  versionId: string | null
  setVersionId: (value: string | null) => void
  messages: AgentChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<AgentChatMessage[]>>
  threadTitle: string | null
  renameThread: (value: string) => void
  applyFirstPromptTitle: (prompt: string) => void
  input: string
  setInput: (value: string) => void
  streaming: boolean
  setStreaming: (value: boolean) => void
  error: string
  setError: (value: string) => void
}

const AgentContext = createContext<AgentContextValue | null>(null)

function readStoredMode(): AgentMode {
  if (typeof window === 'undefined') return 'closed'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'pane' || stored === 'full' || stored === 'closed') return stored
  return 'closed'
}

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const inSettings = isSettingsPath(location.pathname)
  const [mode, setModeState] = useState<AgentMode>(readStoredMode)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [threadTitle, setThreadTitle] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)

  function setMode(value: AgentMode) {
    setModeState(value)
    localStorage.setItem(STORAGE_KEY, value)
  }

  function open() {
    setMode(isDesktop() ? 'pane' : 'full')
  }

  function close() {
    setMode('closed')
  }

  function toggle() {
    if (mode === 'closed') open()
    else close()
  }

  function expand() {
    setMode('full')
  }

  function collapseToPane() {
    setMode(isDesktop() ? 'pane' : 'closed')
  }

  function ask(message: string) {
    const next = message.trim()
    if (!next) return
    open()
    setPendingPrompt(next)
  }

  function clearPendingPrompt() {
    setPendingPrompt(null)
  }

  function renameThread(value: string) {
    const next = value.trim()
    if (!next) return
    setThreadTitle(next)
  }

  function applyFirstPromptTitle(prompt: string) {
    setThreadTitle((current) => {
      if (current != null) return current
      const next = titleFromFirstPrompt(prompt)
      return next || current
    })
  }

  useEffect(() => {
    setMessages([])
    setThreadTitle(null)
    setInput('')
    setError('')
    setVariantId(null)
    setStreaming(false)
  }, [user?.id])

  useEffect(() => {
    trackSettingsReturnPath(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    if (!user) return

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        if (inSettings) return
        event.preventDefault()
        toggle()
        return
      }
      if (event.key !== 'Escape' || mode === 'closed') return
      if (document.querySelector('[data-slot=dialog-content]')) return
      event.preventDefault()
      close()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [user, mode, inSettings])

  const value = useMemo<AgentContextValue>(
    () => ({
      mode,
      open,
      close,
      toggle,
      expand,
      collapseToPane,
      ask,
      pendingPrompt,
      clearPendingPrompt,
      variantId,
      setVariantId,
      versionId,
      setVersionId,
      messages,
      setMessages,
      threadTitle,
      renameThread,
      applyFirstPromptTitle,
      input,
      setInput,
      streaming,
      setStreaming,
      error,
      setError,
    }),
    [mode, pendingPrompt, variantId, versionId, messages, threadTitle, input, streaming, error],
  )

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

export function useAgent() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider')
  }
  return context
}
