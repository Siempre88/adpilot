'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, ScanSearch, X, Send } from 'lucide-react'

interface CriticPanelProps {
  open: boolean
  initialText: string
  initialType?: 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script' | 'ad'
  campaignId?: string | null
  onClose: () => void
}

export function CriticPanel({ open, initialText, initialType, campaignId, onClose }: CriticPanelProps) {
  const [text, setText] = useState(initialText)
  const [type, setType] = useState(initialType ?? 'ad')
  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setText(initialText); setType(initialType ?? 'ad'); setOutput('') }, [initialText, initialType, open])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [output])

  async function handleSubmit() {
    if (!text.trim() || streaming) return
    setStreaming(true)
    setOutput('')
    setError(null)

    try {
      const res = await fetch('/api/creative/critic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creative_text: text.trim(), type_hint: type, campaignId: campaignId ?? undefined }),
      })
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const p = JSON.parse(data)
            if (p.type === 'text-delta' && p.delta) {
              acc += p.delta
              setOutput(acc)
            }
          } catch {}
        }
      }
      if (!acc) setError('El servicio de IA no respondió. Intenta de nuevo.')
    } catch {
      setError('Error de red al evaluar')
    } finally {
      setStreaming(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm">
      <div className="glass-strong relative h-full w-full max-w-2xl overflow-hidden rounded-l-2xl border-l border-white/[0.10] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="logo-glow flex h-8 w-8 items-center justify-center rounded-xl">
              <ScanSearch className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Critic Mode</h2>
              <p className="text-[10px] text-white/50">Evaluación honesta y directa</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Input */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">Pega el creativo a evaluar</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              disabled={streaming}
              placeholder="Hook, copy, script, o anuncio completo..."
              className="w-full resize-none rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-blue-400/50"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <select
                value={type}
                onChange={e => setType(e.target.value as typeof type)}
                disabled={streaming}
                className="rounded-lg border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-[11px] text-white/80 outline-none"
              >
                <option value="ad">Anuncio completo</option>
                <option value="hook">Hook</option>
                <option value="copy">Copy</option>
                <option value="headline">Headline</option>
                <option value="cta">CTA</option>
                <option value="ugc_script">Script UGC</option>
              </select>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={streaming || !text.trim()}
                className="btn-glass inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {streaming ? 'Evaluando...' : 'Evaluar'}
              </button>
            </div>
          </div>

          {/* Output */}
          {(output || error) && (
            <div ref={scrollRef} className={cn('rounded-2xl p-4', error ? 'glass-danger' : 'glass')}>
              {error && <p className="text-sm text-red-200">{error}</p>}
              {output && <FormattedText content={output} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Markdown-lite renderer
function FormattedText({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="mt-3 text-xs text-blue-300">{inline(line.slice(4))}</h3>
        if (line.startsWith('## ')) return <h2 key={i} className="mt-3 text-sm text-blue-300">{inline(line.slice(3))}</h2>
        if (line.startsWith('# ')) return <h1 key={i} className="mt-3 text-base text-white">{inline(line.slice(2))}</h1>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc">{inline(line.slice(2))}</li>
        const num = line.match(/^(\d+)\.\s(.+)/)
        if (num) return <li key={i} className="ml-4 list-decimal">{inline(num[2])}</li>
        if (line.trim() === '') return <br key={i} />
        return <p key={i} className="text-sm text-white/85">{inline(line)}</p>
      })}
    </div>
  )
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-white/[0.10] px-1 py-0.5 text-[11px] text-blue-200">{part.slice(1, -1)}</code>
    return part
  })
}
