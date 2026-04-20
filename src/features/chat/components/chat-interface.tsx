'use client'

import { useRef, useEffect, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { Send, Zap, User, Loader2, ClipboardList, Search, TrendingUp, Sparkles } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const questionGroups = [
  {
    label: 'Operar',
    icon: ClipboardList,
    color: 'text-blue-400 border-blue-500/30 hover:bg-blue-600/10',
    questions: ['¿Qué hago hoy?', '¿Estoy perdiendo dinero?'],
  },
  {
    label: 'Analizar',
    icon: Search,
    color: 'text-purple-400 border-purple-500/30 hover:bg-purple-600/10',
    questions: ['¿Cuál es mi peor campaña?', '¿Por qué Mini donas tiene CTR bajo?'],
  },
  {
    label: 'Escalar',
    icon: TrendingUp,
    color: 'text-green-400 border-green-500/30 hover:bg-green-600/10',
    questions: ['¿Cuál debo escalar primero?', '¿Cuáles son mis top campañas?'],
  },
  {
    label: 'Simular',
    icon: Sparkles,
    color: 'text-amber-400 border-amber-500/30 hover:bg-amber-600/10',
    questions: ['¿Qué pasa si subo presupuesto de Ram 2500?', '¿Qué pasa si cambio el creativo de Mini donas?'],
  },
]

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsLoading(true)
    setInput('')

    const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    let accumulated = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      accumulated = ''
      try {
        if (attempt > 1) {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: `Reintentando (${attempt}/3)...` } : m
          ))
        }

        const res = await fetch('/api/chat', {
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
        if (accumulated && !hasError) break
        if (hasError && !accumulated) continue
        if (accumulated) break
      } catch { continue }
    }

    if (!accumulated) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: 'El servicio de IA no está disponible. Intenta de nuevo en 1-2 minutos.' } : m
      ))
    }

    setIsLoading(false)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col glass rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-600/20 p-2">
            <Zap className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">AdPilot</h2>
            <p className="text-[10px] text-zinc-500">Operador de performance · Datos reales</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] text-zinc-500">act_212677000</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="rounded-2xl bg-blue-600/10 p-4">
              <Zap className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-white">Operador de performance listo</h3>
            <p className="mt-1 text-xs text-zinc-400">Datos reales cargados. Pregunta lo que necesites.</p>

            <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-3">
              {questionGroups.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <group.icon className={cn('h-3 w-3', group.color.split(' ')[0])} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{group.label}</span>
                  </div>
                  {group.questions.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className={cn('w-full rounded-lg border bg-zinc-800/30 px-3 py-2 text-left text-[11px] text-zinc-300 transition-colors', group.color)}>
                      {q}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => {
              if (message.role === 'assistant' && !message.content && !isLoading) return null

              return (
                <div key={message.id} className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {message.role === 'assistant' && (
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600/20">
                      <Zap className="h-3 w-3 text-blue-400" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
                    message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800/80 text-zinc-200'
                  )}>
                    {message.role === 'assistant' ? (
                      message.content ? (
                        <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white [&_h3]:text-xs [&_h3]:text-blue-400">
                          <FormattedMessage content={message.content} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                          <span className="text-[11px] text-zinc-500">Analizando campañas...</span>
                        </div>
                      )
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-700">
                      <User className="h-3 w-3 text-zinc-300" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre tus campañas..."
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
            disabled={isLoading} />
          <button type="submit" disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Markdown-lite renderer ───

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i}>{formatInline(line.slice(4))}</h3>
        if (line.startsWith('## ')) return <h2 key={i}>{formatInline(line.slice(3))}</h2>
        if (line.startsWith('# ')) return <h1 key={i}>{formatInline(line.slice(2))}</h1>
        const numMatch = line.match(/^(\d+)\.\s(.+)/)
        if (numMatch) return <li key={i} className="ml-4 list-decimal">{formatInline(numMatch[2])}</li>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i}>{formatInline(line.slice(2))}</li>
        if (line.trim() === '') return <br key={i} />
        return <p key={i}>{formatInline(line)}</p>
      })}
    </>
  )
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-zinc-700 px-1 py-0.5 text-[11px] text-blue-300">{part.slice(1, -1)}</code>
    }
    return part
  })
}
