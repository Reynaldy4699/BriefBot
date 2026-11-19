import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  Info,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MessageContent } from './components/MessageContent'
import { ASSISTANT_MODES, SAMPLE_ACTIONS } from './data/modes'
import { hasLocalEnvKey, sendChatTurn } from './services/chat'
import type { AssistantModeId, ChatMessage, SampleAction } from './types'

function MessageItem({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard failures
    }
  }

  if (message.role === 'user') {
    return (
      <div className="animate-fade-slide-up flex flex-col items-end gap-1">
        {message.attachedTitle && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#e4e4e7] bg-white px-2.5 py-0.5 font-mono text-[11px] text-[#52525b]">
            <FileText className="h-3 w-3" />
            {message.attachedTitle}
          </span>
        )}
        <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-[#111111] px-4 py-2.5 text-[14.5px] leading-relaxed text-white shadow-xs">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-slide-up group flex flex-col items-start gap-1.5">
      <div className="w-full rounded-2xl border border-[#e4e4e7]/90 bg-white px-5 py-4 shadow-2xs transition-colors duration-200 hover:border-[#d4d4d8]">
        {message.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
            {message.error}
          </div>
        ) : message.content ? (
          <MessageContent content={message.content} />
        ) : (
          <div className="flex items-center gap-1.5 py-1.5">
            <span className="typing-dot-1 h-1.5 w-1.5 rounded-full bg-[#71717a]" />
            <span className="typing-dot-2 h-1.5 w-1.5 rounded-full bg-[#71717a]" />
            <span className="typing-dot-3 h-1.5 w-1.5 rounded-full bg-[#71717a]" />
          </div>
        )}
      </div>

      {!message.isStreaming && message.content && (
        <div className="flex w-full items-center justify-between px-1 text-[11px] text-[#71717a]">
          <div className="flex items-center gap-2 font-mono">
            <span>{message.modelUsed ?? 'assistant'}</span>
            {message.latencyMs !== undefined && (
              <>
                <span>·</span>
                <span>{message.latencyMs}ms</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="smooth-btn inline-flex items-center gap-1 rounded px-1.5 py-0.5 opacity-70 hover:bg-[#f4f4f5] hover:text-[#111111] group-hover:opacity-100"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export function App() {
  const [mode, setMode] = useState<AssistantModeId>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [showContextBox, setShowContextBox] = useState(false)
  const [contextText, setContextText] = useState('')
  const [contextLabel, setContextLabel] = useState('')
  const [showAbout, setShowAbout] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const liveKeyActive = hasLocalEnvKey()
  const currentModeInfo = ASSISTANT_MODES.find((m) => m.id === mode) ?? ASSISTANT_MODES[0]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (
    queryText: string,
    overrideMode?: AssistantModeId,
    overrideContext?: string,
    overrideContextLabel?: string,
  ) => {
    const trimmed = queryText.trim()
    if (!trimmed || isGenerating) return

    const activeMode = overrideMode ?? mode
    const attached = overrideContext !== undefined ? overrideContext : contextText
    const attachedName =
      overrideContextLabel ??
      (attached.trim() ? contextLabel || 'Attached text' : undefined)

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      mode: activeMode,
      attachedTitle: attachedName,
    }

    const assistantId = `a-${Date.now() + 1}`
    const placeholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      mode: activeMode,
      isStreaming: true,
    }

    const historySnapshot = [...messages]
    setMessages((prev) => [...prev, userMsg, placeholder])
    setIsGenerating(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await sendChatTurn({
        mode: activeMode,
        history: historySnapshot,
        userQuery: trimmed,
        contextText: attached,
        signal: controller.signal,
        onToken: (acc) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)),
          )
        },
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: result.text || 'No response generated.',
                latencyMs: result.latencyMs,
                modelUsed: result.modelUsed,
                isStreaming: false,
              }
            : m,
        ),
      )
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                isStreaming: false,
                content: isAbort ? `${m.content}\n\n[Stopped]` : m.content,
                error: isAbort
                  ? undefined
                  : err instanceof Error
                    ? err.message
                    : 'Request failed.',
              }
            : m,
        ),
      )
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const handleSubmit = () => {
    const trimmed = draft.trim()
    if (!trimmed || isGenerating) return
    setDraft('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    void sendMessage(trimmed)
  }

  const handleSampleClick = (sample: SampleAction) => {
    setMode(sample.mode)
    if (sample.contextText) {
      setContextText(sample.contextText)
      setContextLabel(`${sample.badge} sample`)
      setShowContextBox(true)
    }
    void sendMessage(
      sample.prompt,
      sample.mode,
      sample.contextText ?? '',
      sample.contextText ? `${sample.badge} sample` : undefined,
    )
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setContextText(text.slice(0, 15000))
    setContextLabel(file.name)
    setShowContextBox(true)
    e.target.value = ''
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa] text-[#111111]">
      {/* Slim Minimalist Header */}
      <header className="sticky top-0 z-20 border-b border-[#e4e4e7]/80 bg-[#fafafa]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111] text-white transition-transform duration-200 hover:scale-105">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[14.5px] font-semibold tracking-tight">BriefBot</span>
              <span className="hidden text-[12px] text-[#71717a] sm:inline">
                Simple AI Assistant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAbout((v) => !v)}
              className={`smooth-btn inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${
                showAbout
                  ? 'border-[#111111] bg-[#111111] text-white'
                  : 'border-[#e4e4e7] bg-white text-[#52525b] hover:border-[#111111] hover:text-[#111111]'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
              <span>How it works</span>
            </button>

            <div
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${
                liveKeyActive
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                  : 'border-[#e4e4e7] bg-white text-[#52525b]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  liveKeyActive ? 'bg-emerald-500' : 'bg-[#111111]'
                }`}
              />
              <span>{liveKeyActive ? 'Gemini Live' : 'Ready'}</span>
            </div>
          </div>
        </div>

        {/* Collapsible 3-Sentence Overview for Recruiters */}
        {showAbout && (
          <div className="animate-fade-slide-up border-t border-[#e4e4e7] bg-white">
            <div className="mx-auto max-w-3xl px-4 py-4 text-[12.5px] leading-relaxed text-[#52525b] sm:px-6">
              <div className="font-medium text-[#111111]">About BriefBot</div>
              <p className="mt-1">
                BriefBot is a focused React + TypeScript AI assistant built on the Google Gemini
                REST API (<code className="font-mono">gemini-3-flash-preview</code> with automatic{' '}
                <code className="font-mono">503</code> failover to{' '}
                <code className="font-mono">gemini-3.1-flash-lite</code>). It separates prompts
                into three clear task modes (Quick Chat, Summarize Text, Support Reply) and filters
                markdown asterisks for clean readable output. On public static GitHub Pages, no API
                key is embedded in the browser bundle; all modes work immediately via a safe
                client-side engine, while local development reads{' '}
                <code className="font-mono">.env.local</code>.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Main Chat Container */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        <div className="flex-1 overflow-y-auto py-6">
          {messages.length === 0 ? (
            <div className="animate-fade-in flex min-h-full flex-col justify-center py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#71717a]">
                Minimalist AI Chatbot
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111111] sm:text-[28px]">
                Chat, summarize notes, or draft support replies.
              </h1>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-[#52525b]">
                Pick a task mode below or click one of the ready-made examples to test it right
                away.
              </p>

              {/* Mode Selector Pills */}
              <div className="mt-5 flex flex-wrap gap-2">
                {ASSISTANT_MODES.map((m) => {
                  const active = m.id === mode
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`smooth-btn inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium ${
                        active
                          ? 'border-[#111111] bg-[#111111] text-white'
                          : 'border-[#e4e4e7] bg-white text-[#52525b] hover:border-[#111111] hover:text-[#111111]'
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>{m.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[12px] text-[#71717a]">{currentModeInfo.description}</p>

              {/* 3 Sample Cards */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {SAMPLE_ACTIONS.map((sample) => (
                  <button
                    key={sample.title}
                    type="button"
                    onClick={() => handleSampleClick(sample)}
                    className="hover-card group flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#f4f4f5] px-2.5 py-0.5 font-mono text-[10.5px] text-[#52525b]">
                        {sample.badge}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#a1a1aa] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#111111]" />
                    </div>
                    <div className="mt-3">
                      <div className="text-[13.5px] font-medium leading-snug text-[#111111]">
                        {sample.title}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[12px] text-[#71717a]">
                        {sample.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5 pb-4">
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Sticky Minimalist Composer */}
        <div className="pb-5 pt-2">
          {showContextBox && (
            <div className="animate-fade-slide-up mb-2.5 rounded-2xl border border-[#e4e4e7] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-[#52525b]">
                <span className="font-medium text-[#111111]">
                  {contextLabel || 'Attached Text / Document'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setContextText('')
                    setContextLabel('')
                    setShowContextBox(false)
                  }}
                  className="smooth-btn rounded p-0.5 text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#111111]"
                  aria-label="Remove attached text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                rows={3}
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Paste notes, an email, or a customer support ticket here..."
                className="w-full resize-none rounded-xl border border-[#f4f4f5] bg-[#fafafa] p-2.5 text-[12.5px] text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#d4d4d8]"
              />
            </div>
          )}

          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-3 shadow-xs transition-colors duration-200 focus-within:border-[#111111]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder={`Message BriefBot (${currentModeInfo.label})...`}
              className="max-h-36 w-full resize-none bg-transparent px-1 py-1 text-[14px] text-[#111111] placeholder-[#a1a1aa] outline-none"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#f4f4f5] pt-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  aria-label="Assistant mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as AssistantModeId)}
                  className="h-7 cursor-pointer rounded-full border border-[#e4e4e7] bg-[#fafafa] px-2.5 text-[11.5px] font-medium text-[#27272a] outline-none transition-colors hover:border-[#111111]"
                >
                  {ASSISTANT_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setShowContextBox((v) => !v)}
                  className={`smooth-btn inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-medium ${
                    showContextBox || contextText.trim()
                      ? 'border-[#111111] bg-[#111111]/5 text-[#111111]'
                      : 'border-[#e4e4e7] text-[#52525b] hover:border-[#a1a1aa]'
                  }`}
                >
                  <Paperclip className="h-3 w-3" />
                  <span>{contextText.trim() ? 'Text Attached' : 'Attach Text'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="smooth-btn inline-flex h-7 items-center gap-1 rounded-full border border-[#e4e4e7] px-2.5 text-[11.5px] text-[#52525b] hover:border-[#a1a1aa] hover:text-[#111111]"
                >
                  <FileText className="h-3 w-3" />
                  <span>Upload .txt/.md</span>
                </button>

                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([])
                      setContextText('')
                      setContextLabel('')
                      setShowContextBox(false)
                    }}
                    className="smooth-btn inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#111111]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {isGenerating ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="smooth-btn inline-flex h-8 items-center gap-1.5 rounded-full bg-[#111111] px-3.5 text-[12px] font-medium text-white hover:bg-[#27272a]"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!draft.trim()}
                  onClick={handleSubmit}
                  aria-label="Send message"
                  className="smooth-btn inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] text-white hover:bg-[#27272a] disabled:cursor-not-allowed disabled:bg-[#e4e4e7] disabled:text-[#a1a1aa]"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
