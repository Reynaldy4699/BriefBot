import { ASSISTANT_MODES } from '../data/modes'
import type { AssistantModeId, ChatMessage } from '../types'

const MODEL_CHAIN = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'] as const

export function hasLocalEnvKey(): boolean {
  return Boolean((import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim())
}

/**
 * Strips markdown asterisks outside fenced and inline code blocks so responses
 * stay clean without raw '*' characters.
 */
export function sanitizeResponseText(text: string): string {
  const segments = text.split(/(```[\s\S]*?```|`[^`]+`)/g)
  return segments
    .map((segment) => {
      if (segment.startsWith('```') || segment.startsWith('`')) {
        return segment
      }
      return segment.replace(/^(\s*)\*\s+/gm, '$1- ').replace(/\*/g, '')
    })
    .join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildDemoReply(
  mode: AssistantModeId,
  userQuery: string,
  contextText?: string,
): string {
  const q = userQuery.trim()
  const lower = q.toLowerCase()
  const source = (contextText?.trim() || q).trim()

  if (mode === 'summarize') {
    const rawSentences = source
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.replace(/^\d+[.)]\s*|^[-*]\s*/, '').trim())
      .filter((s) => s.length > 12)

    const takeaways = rawSentences.slice(0, 3)
    const actions = rawSentences
      .filter((s) => /\b(will|need to|must|should|starts|before|next|add|fix|review)\b/i.test(s))
      .slice(0, 3)

    const tldr =
      takeaways.length > 0
        ? takeaways.slice(0, 2).join(' ')
        : 'The provided text outlines key operational updates and upcoming tasks.'

    const lines = [
      '### Summary',
      tldr,
      '',
      '### Key Takeaways',
      ...(takeaways.length > 0
        ? takeaways.map((t) => `- ${t}`)
        : ['- Concise overview extracted from your input text.']),
      '',
      '### Action Items',
      ...(actions.length > 0
        ? actions.map((a) => `- ${a}`)
        : ['- Review the takeaways above and assign owners for follow-up.']),
    ]
    return sanitizeResponseText(lines.join('\n'))
  }

  if (mode === 'support') {
    const ticketLower = source.toLowerCase()
    const invoiceMatch = source.match(/#\d+/)
    const hasBilling = /charge|billing|invoice|refund|payment/.test(ticketLower)
    const hasOutage = /outage|webhook|down|error|missed|latency/.test(ticketLower)

    const parts = [
      'Hi there,',
      '',
      'Thank you for reaching out, and sincere apologies for the inconvenience.',
    ]

    if (hasOutage && hasBilling) {
      parts.push(
        `We are reviewing the missed webhook events from yesterday's incident and initiating a refund check for ${invoiceMatch ? `invoice ${invoiceMatch[0]}` : 'the duplicate charge'} right away.`,
      )
    } else if (hasBilling) {
      parts.push(
        `Our billing team is checking ${invoiceMatch ? `invoice ${invoiceMatch[0]}` : 'your recent charge'} and will process any duplicate refund within 1-2 business days.`,
      )
    } else if (hasOutage) {
      parts.push(
        'Our engineering team has identified the service disruption, stabilized delivery, and queued the affected events for replay.',
      )
    } else {
      parts.push(
        'We have received your message and routed it to the right specialist so we can resolve this quickly for you.',
      )
    }

    parts.push(
      '',
      'You will receive a confirmation email as soon as the update is complete. Please reply directly if you need anything else in the meantime.',
      '',
      'Best regards,',
      'Support Team',
    )
    return sanitizeResponseText(parts.join('\n'))
  }

  // Quick Chat mode
  if (
    /^(hi|hey|hello|halo|hai|yo|good\s+(morning|afternoon|evening))[\s!?.,]*$/i.test(q) ||
    /(what can you do|who are you|help|how does this work)/i.test(lower)
  ) {
    return sanitizeResponseText(
      [
        'Hi! I am BriefBot, a minimalist AI assistant with 3 focused modes:',
        '',
        '- Quick Chat: Clear answers for everyday questions and technical topics.',
        '- Summarize Text: Paste notes or attach a .txt/.md file to extract a TL;DR and action items.',
        '- Support Reply: Paste a customer ticket to draft a polite, ready-to-send response.',
        '',
        'Click any sample card or pick a mode above to try it out.',
      ].join('\n'),
    )
  }

  if (/trade-?off|flash|reasoning|model|prompt/.test(lower)) {
    return sanitizeResponseText(
      [
        '### Flash vs. Larger Reasoning Models',
        '',
        '- Latency and UX: Flash models stream first tokens faster, making interactive chat feel instant.',
        '- Cost at Scale: Smaller flash models cost 5x-10x less per million tokens for routine summarization and support drafting.',
        '- Complex Synthesis: Larger reasoning models are best reserved for multi-step analysis or edge cases where flash models miss nuance.',
      ].join('\n'),
    )
  }

  return sanitizeResponseText(
    [
      `You asked: "${q}"`,
      '',
      'BriefBot is running in static GitHub Pages Demo Mode (no API key is bundled in the public frontend for security).',
      '',
      '- Try Summarize Text with pasted meeting notes or a .txt/.md file.',
      '- Try Support Reply with a customer message to generate a clean draft.',
      '- Or ask about model trade-offs and prompt design.',
    ].join('\n'),
  )
}

interface GeminiSseChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

async function streamFromGemini(options: {
  apiKey: string
  model: string
  systemPrompt: string
  temperature: number
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
  signal?: AbortSignal
  onToken: (accumulated: string) => void
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(options.apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.systemPrompt }] },
      contents: options.contents,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: 1000,
      },
    }),
    signal: options.signal,
  })

  if (!res.ok) {
    const errText = await res.text()
    const error = new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 160)}`)
    ;(error as Error & { status?: number }).status = res.status
    throw error
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Streaming unavailable.')

  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload) as GeminiSseChunk
        const parts = parsed.candidates?.[0]?.content?.parts ?? []
        for (const p of parts) {
          if (p.text) {
            accumulated += p.text
            options.onToken(sanitizeResponseText(accumulated))
          }
        }
      } catch {
        // Ignore partial SSE chunk
      }
    }
  }

  return sanitizeResponseText(accumulated)
}

export async function sendChatTurn(params: {
  mode: AssistantModeId
  history: ChatMessage[]
  userQuery: string
  contextText?: string
  signal?: AbortSignal
  onToken: (accumulated: string) => void
}): Promise<{ text: string; latencyMs: number; modelUsed: string }> {
  const startedAt = performance.now()
  const modeInfo = ASSISTANT_MODES.find((m) => m.id === params.mode) ?? ASSISTANT_MODES[0]
  const apiKey = ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '').trim()

  if (!apiKey) {
    const reply = buildDemoReply(params.mode, params.userQuery, params.contextText)
    const tokens = reply.split(/(\s+)/)
    let acc = ''
    for (const tok of tokens) {
      if (params.signal?.aborted) break
      acc += tok
      params.onToken(acc)
      await sleep(14)
    }
    return {
      text: reply,
      latencyMs: Math.round(performance.now() - startedAt),
      modelUsed: 'demo-engine',
    }
  }

  const promptWithContext = params.contextText?.trim()
    ? `${params.userQuery}\n\nAttached Context:\n---\n${params.contextText.trim()}\n---`
    : params.userQuery

  const contents = [
    ...params.history
      .filter((m) => !m.isStreaming && !m.error && m.content.trim().length > 0)
      .slice(-8)
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: m.content }],
      })),
    { role: 'user' as const, parts: [{ text: promptWithContext }] },
  ]

  let lastError: unknown
  for (let i = 0; i < MODEL_CHAIN.length; i += 1) {
    const model = MODEL_CHAIN[i]
    try {
      const text = await streamFromGemini({
        apiKey,
        model,
        systemPrompt: modeInfo.systemPrompt,
        temperature: modeInfo.temperature,
        contents,
        signal: params.signal,
        onToken: params.onToken,
      })
      return {
        text,
        latencyMs: Math.round(performance.now() - startedAt),
        modelUsed: model,
      }
    } catch (err) {
      lastError = err
      const status = (err as Error & { status?: number }).status
      if (params.signal?.aborted) throw err
      if ((status === 503 || status === 429 || status === 404) && i < MODEL_CHAIN.length - 1) {
        continue
      }
      throw err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to reach Gemini API.')
}
