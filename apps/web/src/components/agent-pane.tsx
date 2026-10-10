import Markdown from 'react-markdown'
import { canUseAssistant } from '@formulario/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpIcon,
  Maximize2Icon,
  Minimize2Icon,
  SparklesIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AgentProposalCard, AgentProposalLink } from '@/components/agent-proposal-card'
import { useAgent } from '@/components/agent-provider'
import { EmptyState } from '@/components/empty-state'
import { useSidebar } from '@/components/sidebar-provider'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import {
  Message,
  MessageContent,
  MessageHeader,
} from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { Spinner } from '@/components/ui/spinner'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { useLanguage } from '@/i18n/language-provider'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const PANE_WIDTH_KEY = 'agent-pane-width'
const DEFAULT_PANE_WIDTH = 352
const MIN_PANE_WIDTH = 280
const MAX_PANE_WIDTH = 640

function clampPaneWidth(value: number) {
  const room = typeof window === 'undefined' ? MAX_PANE_WIDTH : window.innerWidth - 360
  const max = Math.min(MAX_PANE_WIDTH, Math.max(MIN_PANE_WIDTH, room))
  return Math.min(max, Math.max(MIN_PANE_WIDTH, Math.round(value)))
}

function readStoredPaneWidth() {
  const raw = Number(localStorage.getItem(PANE_WIDTH_KEY))
  if (!Number.isFinite(raw)) return DEFAULT_PANE_WIDTH
  return clampPaneWidth(raw)
}

function AgentPaneResizeHandle({
  width,
  onWidthChange,
  onDraggingChange,
}: {
  width: number
  onWidthChange: (width: number) => void
  onDraggingChange: (dragging: boolean) => void
}) {
  const { t } = useLanguage()
  const widthRef = useRef(width)
  const [dragging, setDragging] = useState(false)
  widthRef.current = width

  function setDragState(next: boolean) {
    setDragging(next)
    onDraggingChange(next)
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = widthRef.current
    handle.setPointerCapture(event.pointerId)
    setDragState(true)
    document.body.classList.add('select-none')

    function onPointerMove(moveEvent: PointerEvent) {
      onWidthChange(clampPaneWidth(startWidth + (startX - moveEvent.clientX)))
    }

    function onPointerUp(upEvent: PointerEvent) {
      handle.releasePointerCapture(upEvent.pointerId)
      handle.removeEventListener('pointermove', onPointerMove)
      handle.removeEventListener('pointerup', onPointerUp)
      handle.removeEventListener('pointercancel', onPointerUp)
      document.body.classList.remove('select-none')
      setDragState(false)
    }

    handle.addEventListener('pointermove', onPointerMove)
    handle.addEventListener('pointerup', onPointerUp)
    handle.addEventListener('pointercancel', onPointerUp)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onWidthChange(clampPaneWidth(width + 16))
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      onWidthChange(clampPaneWidth(width - 16))
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onWidthChange(DEFAULT_PANE_WIDTH)
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('agent.resize')}
      aria-valuenow={width}
      aria-valuemin={MIN_PANE_WIDTH}
      aria-valuemax={MAX_PANE_WIDTH}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group/resize absolute inset-y-0 left-0 z-10 hidden w-3 cursor-col-resize touch-none md:block"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sidebar-border"
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 left-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/35 transition-opacity duration-150',
          dragging ? 'opacity-100' : 'opacity-0 group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100',
        )}
      />
    </div>
  )
}

export function AgentLauncher() {
  const { t } = useLanguage()
  const { mode, toggle } = useAgent()
  const { setMobileOpen } = useSidebar()
  const open = mode !== 'closed'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={open}
      title={`${open ? t('agent.close') : t('agent.ask')} ⌘J`}
      className={cn(
        'bg-transparent px-0 hover:bg-transparent',
        open ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={() => {
        setMobileOpen(false)
        toggle()
      }}
    >
      {t('agent.ask')}
      <SparklesIcon data-icon="inline-end" />
    </Button>
  )
}

export function AgentPane() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const {
    mode,
    close,
    expand,
    collapseToPane,
    pendingPrompt,
    clearPendingPrompt,
    variantId,
    versionId,
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
  } = useAgent()

  const [paneWidth, setPaneWidth] = useState(readStoredPaneWidth)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    localStorage.setItem(PANE_WIDTH_KEY, String(paneWidth))
  }, [paneWidth])

  const productMatch = location.pathname.match(/^\/products\/([^/]+)$/)
  const productId = productMatch?.[1]

  const { data: proposalData } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.listProposals(),
    enabled: !!user && canUseAssistant(user.plan) && mode !== 'closed',
  })
  const proposals = proposalData?.proposals ?? []

  const resolveMutation = useMutation({
    mutationFn: ({ proposalId, action }: { proposalId: string; action: 'accepted' | 'rejected' }) =>
      api.resolveProposal(proposalId, action),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      if (result.proposal.status === 'rejected') {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'system', content: t('agent.proposalRejected') },
        ])
        return
      }
      if (result.product) {
        const product = result.product
        const href = `/products/${product.id}`
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'system',
            content: t('agent.productCreated', { name: product.name }),
            href,
            hrefLabel: t('agent.openProduct'),
          },
        ])
        return
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'system', content: t('agent.proposalAccepted') },
      ])
    },
  })

  async function send(text = input) {
    if (!user || !text.trim() || streaming) return
    const userMessage = text.trim()
    applyFirstPromptTitle(userMessage)
    setInput('')
    setError('')
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: userMessage },
    ])
    setStreaming(true)

    let assistant = ''
    let lastPaint = 0
    const assistantId = crypto.randomUUID()

    try {
      await api.streamAgent(
        {
          userId: user.id,
          // One thread per person per organization: team members never share chat memory.
          threadId: `formulario:v3:${user.activeOrganizationId ?? 'personal'}:${user.id}`,
          message: userMessage,
          productId,
          variantId: variantId ?? undefined,
          versionId: versionId ?? undefined,
        },
        (chunk) => {
          assistant += chunk
          const now = Date.now()
          if (now - lastPaint < 80) return
          lastPaint = now
          setMessages((prev) => {
            const next = [...prev]
            const index = next.findIndex((item) => item.id === assistantId)
            if (index === -1) {
              next.push({ id: assistantId, role: 'assistant', content: assistant })
            } else {
              next[index] = { ...next[index], content: assistant }
            }
            return next
          })
        },
      )
      if (assistant) {
        setMessages((prev) => {
          const next = [...prev]
          const index = next.findIndex((item) => item.id === assistantId)
          if (index === -1) {
            next.push({ id: assistantId, role: 'assistant', content: assistant })
          } else {
            next[index] = { ...next[index], content: assistant }
          }
          return next
        })
      }
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('agent.failed'))
    } finally {
      // Tools may have completed even if a later model step failed.
      for (const key of ['proposals', 'workspace', 'products', 'home', 'ingredients']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      setStreaming(false)
    }
  }

  useEffect(() => {
    if (!pendingPrompt) return
    if (!user || !canUseAssistant(user.plan)) {
      clearPendingPrompt()
      return
    }
    if (streaming) return
    const text = pendingPrompt
    clearPendingPrompt()
    void send(text)
  }, [pendingPrompt, user, streaming])

  const lastMessage = messages[messages.length - 1]
  const waitingOnFirstToken = streaming && lastMessage?.role !== 'assistant'
  const allowed = !!user && canUseAssistant(user.plan)

  const closed = mode === 'closed'

  return (
    <aside
      className={cn(
        'relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-background',
        'fixed inset-0 z-40 transition-[width,flex-grow,flex-basis,transform,opacity,border-color] duration-200 ease-out motion-reduce:transition-none',
        'md:static md:inset-auto md:h-full md:translate-x-0',
        closed &&
          'pointer-events-none max-md:translate-x-full md:w-0 md:flex-none md:basis-0 md:opacity-0',
        mode === 'pane' &&
          'max-md:translate-x-0 md:w-[var(--agent-pane-width,22rem)] md:flex-none md:opacity-100',
        mode === 'full' &&
          'max-md:translate-x-0 md:min-w-0 md:flex-1 md:opacity-100',
        resizing && 'md:transition-none',
      )}
      style={
        mode === 'pane' || closed
          ? ({ '--agent-pane-width': `${paneWidth}px` } as React.CSSProperties)
          : undefined
      }
      aria-hidden={closed}
      inert={closed ? true : undefined}
    >
      {mode === 'pane' ? (
        <AgentPaneResizeHandle
          width={paneWidth}
          onWidthChange={setPaneWidth}
          onDraggingChange={setResizing}
        />
      ) : null}
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <div className="min-w-0 flex-1 text-sm font-medium">
          <ThreadTitleInput
            name={threadTitle ?? t('agent.title')}
            onSave={renameThread}
          />
        </div>
        <div className="hidden items-center gap-0.5 md:flex">
          {mode === 'pane' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('agent.expand')}
              title={t('agent.expand')}
              onClick={expand}
            >
              <Maximize2Icon />
            </Button>
          ) : null}
          {mode === 'full' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('agent.collapse')}
              title={t('agent.collapse')}
              onClick={collapseToPane}
            >
              <Minimize2Icon />
            </Button>
          ) : null}
        </div>
        {mode === 'pane' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('agent.close')}
            title={t('agent.close')}
            onClick={close}
          >
            <XIcon />
          </Button>
        ) : null}
        {mode === 'full' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={t('agent.close')}
            title={t('agent.close')}
            onClick={close}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>

      {!allowed ? (
        <div className="flex min-h-0 flex-1 items-center p-4">
          <EmptyState title={t('agent.paidTitle')} description={t('agent.paidDescription')} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageScrollerProvider autoScroll>
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport aria-label={t('agent.messages')}>
                <MessageScrollerContent className="mx-auto w-full max-w-[900px] gap-4 px-3 py-4">
                  {messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === 'user'}
                    >
                      {message.role === 'system' ? (
                        <Marker>
                          <MarkerContent>
                            {message.content}
                            {message.href && message.hrefLabel ? (
                              <>
                                {' '}
                                <AgentProposalLink to={message.href} label={message.hrefLabel} />
                              </>
                            ) : null}
                          </MarkerContent>
                        </Marker>
                      ) : (
                        <Message align={message.role === 'user' ? 'end' : 'start'}>
                          <MessageContent>
                            <MessageHeader>
                              {message.role === 'user' ? t('agent.you') : t('agent.agent')}
                            </MessageHeader>
                            <Bubble variant={message.role === 'user' ? 'default' : 'muted'}>
                              <BubbleContent>
                                {message.role === 'assistant' ? (
                                  <div className="min-w-0 whitespace-normal break-words [&>*+*]:mt-3 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li+li]:mt-1 [&_a]:underline [&_a]:underline-offset-4 [&_a]:break-all [&_a]:focus-visible:outline-ring [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:font-mono [&_code]:text-xs">
                                    <Markdown skipHtml disallowedElements={['img']}>
                                      {message.content}
                                    </Markdown>
                                  </div>
                                ) : message.content}
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      )}
                    </MessageScrollerItem>
                  ))}

                  {waitingOnFirstToken ? (
                    <MessageScrollerItem messageId="thinking">
                      <Marker role="status">
                        <MarkerIcon>
                          <Spinner />
                        </MarkerIcon>
                        <MarkerContent>{t('agent.thinking')}</MarkerContent>
                      </Marker>
                    </MessageScrollerItem>
                  ) : null}

                  {proposals.map((proposal) => (
                    <MessageScrollerItem key={proposal.id} messageId={proposal.id}>
                      <AgentProposalCard
                        proposal={proposal}
                        accepting={
                          resolveMutation.isPending &&
                          resolveMutation.variables?.proposalId === proposal.id &&
                          resolveMutation.variables.action === 'accepted'
                        }
                        rejecting={
                          resolveMutation.isPending &&
                          resolveMutation.variables?.proposalId === proposal.id &&
                          resolveMutation.variables.action === 'rejected'
                        }
                        onAccept={() =>
                          resolveMutation.mutate({ proposalId: proposal.id, action: 'accepted' })
                        }
                        onReject={() =>
                          resolveMutation.mutate({ proposalId: proposal.id, action: 'rejected' })
                        }
                      />
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>

          <div className="flex shrink-0 flex-col gap-2 p-3">
            <div className="mx-auto flex w-full max-w-[900px] flex-col gap-2">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <InputGroup>
                <InputGroupTextarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                  placeholder={t('agent.placeholder')}
                  rows={2}
                  disabled={streaming}
                  aria-label={t('agent.placeholder')}
                />
                <InputGroupAddon align="block-end">
                  <InputGroupButton
                    variant="default"
                    size="icon-xs"
                    className="ml-auto rounded-full"
                    disabled={streaming || !input.trim()}
                    onClick={() => void send()}
                    aria-label={streaming ? t('agent.thinking') : t('agent.send')}
                  >
                    {streaming ? <Spinner className="size-3" /> : <ArrowUpIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function ThreadTitleInput({
  name,
  onSave,
}: {
  name: string
  onSave: (name: string) => void
}) {
  const { t } = useLanguage()

  return (
    <input
      key={name}
      defaultValue={name}
      maxLength={80}
      onBlur={(event) => {
        const next = event.currentTarget.value.trim()
        if (!next) {
          event.currentTarget.value = name
          return
        }
        if (next !== name) onSave(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          event.currentTarget.value = name
          event.currentTarget.blur()
        }
      }}
      aria-label={t('agent.renameThread')}
      title={name}
      className="-mx-1 w-full min-w-0 truncate rounded-md bg-transparent px-1 py-0.5 font-[inherit] text-[inherit] leading-[inherit] tracking-[inherit] outline-none hover:bg-muted/50 focus:bg-muted/50 focus:ring-2 focus:ring-ring/40"
    />
  )
}
