'use client'

import { useRef, useEffect, useState, useCallback, type FormEvent, type ChangeEvent } from 'react'
import { cn } from '@/lib/utils'
import {
  Send, ShieldAlert, User, Loader2, ImagePlus, Type, FileText,
  X, Image as ImageIcon, CheckCircle2, XCircle, AlertTriangle,
  Wrench, TrendingUp, Target, Ban, ThumbsUp,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  image?: string
}

const examplePrompts = [
  { icon: Type, label: 'Evaluar copy', prompt: 'Evalúa este copy:\nHook: "¿Buscas el mejor precio?"\nHeadline: "Oferta especial solo hoy"\nBody: "No te lo pierdas, contáctanos"\nCTA: "Más info"' },
  { icon: ImageIcon, label: 'Evaluar concepto', prompt: 'Quiero hacer un anuncio de Mini donas con una foto de las donas sobre una mesa de madera. El headline sería "Antojo de algo dulce?" y el CTA "Pedir ahora". ¿Funcionaría?' },
  { icon: FileText, label: 'Evaluar landing', prompt: 'Mi landing dice "Bienvenido" en grande, luego un formulario de contacto. Sin fotos del producto. ¿Está bien para un ad de ventas?' },
]

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// ─── Verdict Parser ───
// Parses the critic response into structured blocks for visual rendering

interface ParsedVerdict {
  verdict: 'NO PUBLICAR' | 'PROBAR' | 'PUBLICAR' | null
  analysis_good: string
  analysis_bad: string
  problem: string
  impact: string
  vs_winners: string
  changes: string[]
  verdict_reason: string
  fixed_hook: string
  fixed_copy: string
  fixed_cta: string
  fixed_reason: string
  raw_text: string // fallback
}

function parseResponse(text: string): ParsedVerdict {
  const r: ParsedVerdict = {
    verdict: null, analysis_good: '', analysis_bad: '', problem: '', impact: '',
    vs_winners: '', changes: [], verdict_reason: '', fixed_hook: '', fixed_copy: '',
    fixed_cta: '', fixed_reason: '', raw_text: text,
  }

  // Detect verdict
  if (text.includes('NO PUBLICAR') || text.includes('NO_PUBLICAR')) r.verdict = 'NO PUBLICAR'
  else if (text.includes('PROBAR')) r.verdict = 'PROBAR'
  else if (text.includes('PUBLICAR')) r.verdict = 'PUBLICAR'

  // Extract sections with regex
  const extract = (pattern: RegExp) => {
    const m = text.match(pattern)
    return m ? m[1].trim() : ''
  }

  // Analysis
  const analysisMatch = text.match(/\*\*ANÁLISIS:\*\*([\s\S]*?)(?=\*\*PROBLEMA|\*\*IMPACTO|$)/i)
  if (analysisMatch) {
    const block = analysisMatch[1]
    const goodMatch = block.match(/bueno[:\s]*(.*?)(?=\n.*malo|\n\*\*|$)/i)
    const badMatch = block.match(/malo[:\s]*([\s\S]*?)(?=\n\*\*|$)/i)
    r.analysis_good = goodMatch ? goodMatch[1].replace(/^[-*]\s*/, '').trim() : ''
    r.analysis_bad = badMatch ? badMatch[1].replace(/^[-*]\s*/gm, '').trim() : ''
  }

  // Problem
  const probMatch = text.match(/\*\*PROBLEMA PRINCIPAL:\*\*\s*(.*?)(?=\n\*\*|$)/i)
  if (probMatch) r.problem = probMatch[1].trim()

  // Impact
  const impMatch = text.match(/\*\*IMPACTO:\*\*\s*(.*?)(?=\n\*\*|$)/i)
  if (impMatch) r.impact = impMatch[1].trim()

  // VS winners
  const vsMatch = text.match(/\*\*VS TUS GANADORAS:\*\*\s*(.*?)(?=\n\*\*|$)/i)
  if (vsMatch) r.vs_winners = vsMatch[1].trim()

  // Changes
  const changesMatch = text.match(/\*\*QUÉ CAMBIAR:\*\*([\s\S]*?)(?=\*\*VEREDICTO|$)/i)
  if (changesMatch) {
    r.changes = changesMatch[1].split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter(l => l.length > 3)
  }

  // Verdict reason (text after VEREDICTO line)
  const verdictMatch = text.match(/\*\*VEREDICTO:\*\*.*?\n([\s\S]*?)(?=\*\*VERSIÓN CORREGIDA|---|\n\n\n|$)/i)
  if (verdictMatch) r.verdict_reason = verdictMatch[1].replace(/^[-*\n\s]+/, '').trim()

  // Fixed creative
  const fixedMatch = text.match(/\*\*VERSIÓN CORREGIDA:\*\*([\s\S]*?)(?=\*\*Por qué ahora|$)/i)
  if (fixedMatch) {
    const block = fixedMatch[1]
    const hookM = block.match(/\*\*Hook:\*\*\s*(.*)/i)
    const copyM = block.match(/\*\*Copy:\*\*\s*(.*)/i)
    const ctaM = block.match(/\*\*CTA:\*\*\s*(.*)/i)
    if (hookM) r.fixed_hook = hookM[1].trim()
    if (copyM) r.fixed_copy = copyM[1].trim()
    if (ctaM) r.fixed_cta = ctaM[1].trim()
  }

  const fixReasonMatch = text.match(/\*\*Por qué ahora sí funciona:\*\*\s*(.*?)(?=\n\n|$)/i)
  if (fixReasonMatch) r.fixed_reason = fixReasonMatch[1].trim()

  return r
}

// ─── Verdict Card Component ───

function VerdictCard({ parsed }: { parsed: ParsedVerdict }) {
  // If we couldn't parse a verdict, show raw text
  if (!parsed.verdict && !parsed.problem) {
    return <RawMessage content={parsed.raw_text} />
  }

  const verdictConfig = {
    'NO PUBLICAR': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: Ban, label: 'NO PUBLICAR' },
    'PROBAR': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', icon: AlertTriangle, label: 'PROBAR' },
    'PUBLICAR': { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/25', icon: ThumbsUp, label: 'PUBLICAR' },
  }

  const vc = parsed.verdict ? verdictConfig[parsed.verdict] : verdictConfig['NO PUBLICAR']
  const VIcon = vc.icon

  return (
    <div className="space-y-3">
      {/* VERDICT — hero */}
      <div className={cn('flex items-center gap-3 rounded-xl border p-4', vc.border, vc.bg)}>
        <VIcon className={cn('h-7 w-7 shrink-0', vc.color)} />
        <div>
          <p className={cn('text-lg font-black tracking-wide', vc.color)}>{vc.label}</p>
          {parsed.verdict_reason && (
            <p className="mt-0.5 text-xs text-zinc-300">{parsed.verdict_reason.slice(0, 120)}</p>
          )}
        </div>
      </div>

      {/* Problem + Impact row */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {parsed.problem && (
          <div className="rounded-lg border border-red-500/10 bg-zinc-800/60 p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-red-400">
              <XCircle className="h-3 w-3" /> Problema principal
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">{cleanBold(parsed.problem)}</p>
          </div>
        )}
        {parsed.impact && (
          <div className="rounded-lg border border-amber-500/10 bg-zinc-800/60 p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">
              <Target className="h-3 w-3" /> Impacto
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">{cleanBold(parsed.impact)}</p>
          </div>
        )}
      </div>

      {/* VS Winners */}
      {parsed.vs_winners && (
        <div className="rounded-lg border border-blue-500/10 bg-zinc-800/60 p-3">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-blue-400">
            <TrendingUp className="h-3 w-3" /> vs tus ganadoras
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">{cleanBold(parsed.vs_winners)}</p>
        </div>
      )}

      {/* Changes */}
      {parsed.changes.length > 0 && (
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/60 p-3">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            <Wrench className="h-3 w-3" /> Qué cambiar
          </div>
          <ol className="mt-1.5 space-y-1">
            {parsed.changes.map((c, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-200">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-bold text-zinc-300">{i + 1}</span>
                {cleanBold(c)}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Fixed creative */}
      {parsed.fixed_hook && (
        <div className="rounded-xl border border-green-500/15 bg-green-950/10 p-4">
          <div className="mb-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-green-400">
            <CheckCircle2 className="h-3 w-3" /> Versión corregida
          </div>
          <div className="space-y-2">
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <p className="text-[9px] font-bold text-amber-400">HOOK</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{parsed.fixed_hook}</p>
            </div>
            {parsed.fixed_copy && (
              <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
                <p className="text-[9px] font-bold text-zinc-500">COPY</p>
                <p className="mt-0.5 text-xs text-zinc-200">{parsed.fixed_copy}</p>
              </div>
            )}
            {parsed.fixed_cta && (
              <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
                <p className="text-[9px] font-bold text-blue-400">CTA</p>
                <p className="mt-0.5 text-sm font-bold text-blue-300">{parsed.fixed_cta}</p>
              </div>
            )}
          </div>
          {parsed.fixed_reason && (
            <p className="mt-2 text-[11px] text-green-400/80">{cleanBold(parsed.fixed_reason)}</p>
          )}
        </div>
      )}
    </div>
  )
}

function cleanBold(text: string): string {
  return text.replace(/\*\*/g, '')
}

// ─── Raw fallback ───
function RawMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-white">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="text-xs font-bold text-red-400">{line.slice(4)}</h3>
        const num = line.match(/^(\d+)\.\s(.+)/)
        if (num) return <li key={i} className="ml-4 list-decimal">{fmtInline(num[2])}</li>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i}>{fmtInline(line.slice(2))}</li>
        if (line.trim() === '') return <br key={i} />
        return <p key={i}>{fmtInline(line)}</p>
      })}
    </div>
  )
}

function fmtInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p
  )
}

// ─── Main Component ───

export function Critic() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 240) + 'px'
  }, [])

  useEffect(() => { autoResize() }, [input, autoResize])

  function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) return
    if (file.size > 5 * 1024 * 1024) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function clearImage() { setImagePreview(null); setImageName(null) }

  const canSend = (input.trim() || imagePreview) && !isLoading

  async function sendMessage(text: string, image?: string | null) {
    if (!text.trim() && !image) return
    if (isLoading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim(), image: image || undefined }
    const assistantId = (Date.now() + 1).toString()

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setIsLoading(true)
    setInput('')
    clearImage()

    let apiContent = text.trim()
    if (image) {
      const note = `[El usuario adjuntó una imagen de su creativo: ${imageName || 'imagen'}]`
      apiContent = apiContent ? `${note}\n\n${apiContent}` : `${note}\n\nEvalúa esta imagen como creativo publicitario.`
    }

    const allMessages = [...messages, { role: 'user' as const, content: apiContent }].map(m => ({ role: m.role, content: m.content }))

    // Try up to 3 times (model rotation happens server-side)
    let accumulated = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      accumulated = ''
      try {
        setMessages(prev => prev.map(m => m.id === assistantId
          ? { ...m, content: attempt > 1 ? `Reintentando (intento ${attempt}/3)...` : '' }
          : m))

        const res = await fetch('/api/critic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: allMessages }),
        })
        const reader = res.body?.getReader()
        if (!reader) continue

        const decoder = new TextDecoder()
        let hasError = false
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
                accumulated += p.delta
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m))
              }
              if (p.type === 'error') { hasError = true }
            } catch {}
          }
        }
        if (accumulated && !hasError) break // Success
        if (hasError && !accumulated) continue // Retry
        if (accumulated) break // Got some text, use it
      } catch { continue }
    }

    if (!accumulated) {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: 'El servicio de IA no está disponible en este momento. Intenta de nuevo en 1-2 minutos.' }
        : m))
    }
    setIsLoading(false)
  }

  function handleSubmit(e: FormEvent) { e.preventDefault(); sendMessage(input, imagePreview) }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) sendMessage(input, imagePreview) }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border border-red-500/15 bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-red-600/20 p-2"><ShieldAlert className="h-4 w-4 text-red-400" /></div>
          <div>
            <h2 className="text-sm font-semibold text-white">AdPilot Critic</h2>
            <p className="text-[10px] text-zinc-500">Evaluador brutal · No suaviza · Protege tu dinero</p>
          </div>
        </div>
        <span className="rounded bg-red-400/10 px-2 py-0.5 text-[9px] font-bold text-red-400">SIN FILTRO</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="rounded-2xl bg-red-600/10 p-4"><ShieldAlert className="h-8 w-8 text-red-400" /></div>
            <h3 className="mt-3 text-base font-semibold text-white">Mándame tu creativo</h3>
            <p className="mt-1 max-w-md text-center text-xs text-zinc-400">
              Pega tu copy, sube tu imagen, o ambos. Te digo si sirve o si va a quemar dinero.
            </p>
            <div className="mt-5 grid w-full max-w-lg gap-2">
              {examplePrompts.map(ep => (
                <button key={ep.label} onClick={() => sendMessage(ep.prompt)}
                  className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-4 py-3 text-left transition-colors hover:border-red-500/30 hover:bg-red-950/10">
                  <ep.icon className="h-4 w-4 shrink-0 text-red-400" />
                  <div>
                    <p className="text-xs font-medium text-white">{ep.label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1">{ep.prompt.slice(0, 60)}...</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(message => {
              if (message.role === 'assistant' && !message.content && !isLoading) return null

              // User message
              if (message.role === 'user') {
                return (
                  <div key={message.id} className="flex justify-end gap-3">
                    <div className="max-w-[85%] rounded-2xl bg-zinc-700 px-4 py-3 text-[13px] text-white">
                      {message.image && <img src={message.image} alt="Creative" className="mb-2 max-h-48 rounded-lg border border-zinc-600 object-contain" />}
                      {message.content && <p className="whitespace-pre-line">{message.content}</p>}
                    </div>
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-700">
                      <User className="h-3 w-3 text-zinc-300" />
                    </div>
                  </div>
                )
              }

              // Assistant message — structured verdict
              const isComplete = !isLoading || messages.indexOf(message) < messages.length - 1
              const parsed = isComplete && message.content ? parseResponse(message.content) : null

              return (
                <div key={message.id} className="flex gap-3">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-600/20">
                    <ShieldAlert className="h-3 w-3 text-red-400" />
                  </div>
                  <div className="max-w-[90%] min-w-[60%]">
                    {!message.content ? (
                      <div className="rounded-2xl bg-zinc-800/80 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                          <span className="text-[11px] text-zinc-500">Analizando tu creativo...</span>
                        </div>
                      </div>
                    ) : parsed && parsed.verdict ? (
                      <VerdictCard parsed={parsed} />
                    ) : (
                      <div className="rounded-2xl bg-zinc-800/80 px-4 py-3 text-[13px] leading-relaxed text-zinc-200">
                        <RawMessage content={message.content} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 p-3">
        {imagePreview && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="h-20 rounded-lg border border-zinc-700 object-cover" />
              <button onClick={clearImage} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">{imageName}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleImageSelect} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
              imagePreview ? 'border-red-500/40 bg-red-600/20 text-red-400' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-500/30 hover:text-red-400',
              isLoading && 'opacity-50 cursor-not-allowed')}>
            <ImagePlus className="h-4 w-4" />
          </button>
          <div className="relative flex-1">
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Pega tu anuncio aquí. Si está mal, te lo voy a decir sin filtro."
              rows={2} disabled={isLoading}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500 disabled:opacity-50"
              style={{ minHeight: '80px', maxHeight: '240px' }} />
            {!input.trim() && !imagePreview && (
              <p className="pointer-events-none absolute bottom-2 right-3 text-[9px] text-zinc-600">Shift+Enter para nueva línea</p>
            )}
          </div>
          <button type="submit" disabled={!canSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
