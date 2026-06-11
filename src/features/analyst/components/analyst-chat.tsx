'use client'

import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'
import { AnalystEmptyState } from './analyst-empty-state'
import { AnalystInput } from './analyst-input'
import { AnalystMessage } from './analyst-message'
import { AnalystSuggestions } from './analyst-suggestions'
import type { AnalystEmpty, ChatMessage } from '../types'

type PrecheckResult = AnalystEmpty | { state: 'ready' }

export function AnalystChat() {
  const [pre, setPre] = useState<PrecheckResult | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initial precheck
  useEffect(() => {
    fetch('/api/analyst', { cache: 'no-store' })
      .then(r => r.json())
      .then(json => setPre(json as PrecheckResult))
      .catch(() => setPre({ state: 'ready' })) // fail open
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streamingId) return

    const userMsg: ChatMessage = { id: id(), role: 'user', content: trimmed }
    const assistantId = id()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setStreamingId(assistantId)
    setInput('')

    const allMessages = [...messages, userMsg].map(m => ({ id: m.id, role: m.role, content: m.content }))

    let accumulated = ''
    let attempts = 0
    const MAX = 3

    while (attempts < MAX) {
      attempts++
      accumulated = ''
      try {
        if (attempts > 1) {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: `Reintentando (${attempts}/${MAX})...` } : m
          ))
        }
        const res = await fetch('/api/analyst', {
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
              if (p.type === 'error') hasError = true
            } catch {}
          }
        }
        if (accumulated && !hasError) break
      } catch {
        continue
      }
    }

    if (!accumulated) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'El servicio de IA no está disponible. Intenta de nuevo en 1-2 minutos.' }
          : m
      ))
    }
    setStreamingId(null)
  }

  // Render states
  if (!pre) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="logo-glow flex h-10 w-10 items-center justify-center rounded-xl">
          <Zap className="h-5 w-5 animate-pulse text-white" strokeWidth={2.5} />
        </div>
      </div>
    )
  }

  if (pre.state === 'empty') return <AnalystEmptyState data={pre} />

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      {/* Header */}
      <div className="glass flex items-center justify-between rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="logo-glow flex h-8 w-8 items-center justify-center rounded-xl">
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Analyst</h2>
            <p className="text-[10px] text-white/50">Operador de performance · Datos reales</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-[11px] text-white/40 hover:text-white/80"
          >
            Nueva conversación
          </button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="logo-glow flex h-12 w-12 items-center justify-center rounded-2xl">
              <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <h3 className="mt-4 text-base font-bold text-white">Analyst listo</h3>
            <p className="mt-1 text-xs text-white/50">Pregunta lo que necesites. Datos reales, sin rodeos.</p>
            <div className="mt-6 w-full max-w-2xl">
              <AnalystSuggestions onPick={sendMessage} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-1 py-2">
            {messages.map(m => (
              <AnalystMessage key={m.id} message={m} isStreaming={streamingId === m.id} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <AnalystInput
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage(input)}
        disabled={!!streamingId}
      />
    </div>
  )
}

function id() { return Math.random().toString(36).slice(2, 11) }
