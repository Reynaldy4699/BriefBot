import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { sanitizeResponseText } from '../services/chat'

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[12px] text-[#18181b]"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard failures
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[#e4e4e7] bg-[#fafafa]">
      <div className="flex items-center justify-between border-b border-[#e4e4e7] px-3 py-1.5 text-[11px] text-[#71717a]">
        <span className="font-mono uppercase">{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="smooth-btn inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[#e4e4e7]/60 hover:text-[#111111]"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-[#18181b]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function MessageContent({ content }: { content: string }) {
  const clean = sanitizeResponseText(content)
  const blocks = clean.split(/(```[\s\S]*?```)/g)

  return (
    <div className="space-y-2 text-[14.5px] leading-[1.68] text-[#27272a]">
      {blocks.map((block, bIdx) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          const inner = block.slice(3, -3)
          const nl = inner.indexOf('\n')
          const lang = nl >= 0 ? inner.slice(0, nl).trim() : ''
          const code = nl >= 0 ? inner.slice(nl + 1) : inner
          return <CodeBlock key={bIdx} code={code.trimEnd()} lang={lang} />
        }

        const lines = block.split('\n')
        const nodes: React.ReactNode[] = []
        let bullets: string[] = []

        const flushBullets = (keyPrefix: string) => {
          if (bullets.length === 0) return
          nodes.push(
            <ul key={`${keyPrefix}-ul`} className="my-1.5 space-y-1 pl-4">
              {bullets.map((item, idx) => (
                <li
                  key={idx}
                  className="relative pl-2.5 before:absolute before:left-0 before:top-[0.62em] before:h-1 before:w-1 before:rounded-full before:bg-[#a1a1aa]"
                >
                  {renderInline(item)}
                </li>
              ))}
            </ul>,
          )
          bullets = []
        }

        lines.forEach((line, lIdx) => {
          const trimmed = line.trim()
          if (!trimmed) {
            flushBullets(`${bIdx}-${lIdx}`)
            return
          }

          if (/^-\s+/.test(trimmed)) {
            bullets.push(trimmed.replace(/^-\s+/, ''))
            return
          }

          flushBullets(`${bIdx}-${lIdx}`)

          if (trimmed.startsWith('### ')) {
            nodes.push(
              <h4 key={`${bIdx}-${lIdx}`} className="pt-1 text-[13.5px] font-semibold text-[#111111]">
                {renderInline(trimmed.slice(4))}
              </h4>,
            )
          } else if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
            nodes.push(
              <h3 key={`${bIdx}-${lIdx}`} className="pt-1 text-[15px] font-semibold text-[#111111]">
                {renderInline(trimmed.replace(/^#+\s+/, ''))}
              </h3>,
            )
          } else {
            nodes.push(<p key={`${bIdx}-${lIdx}`}>{renderInline(trimmed)}</p>)
          }
        })

        flushBullets(`${bIdx}-end`)
        return <div key={bIdx}>{nodes}</div>
      })}
    </div>
  )
}
