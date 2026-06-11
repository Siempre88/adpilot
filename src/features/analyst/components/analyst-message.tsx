'use client'

import { cn } from '@/lib/utils'
import { Zap, User } from 'lucide-react'
import { AnalystLoading } from './analyst-loading'
import type { ChatMessage } from '../types'

interface MessageProps {
  message: ChatMessage
  isStreaming: boolean
}

export function AnalystMessage({ message, isStreaming }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="logo-glow mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
          isUser
            ? 'bg-blue-600/90 text-white shadow-glow-blue'
            : 'glass text-white/90'
        )}
      >
        {message.content
          ? <FormattedText content={message.content} />
          : isStreaming ? <AnalystLoading /> : null}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.10] bg-white/[0.06]">
          <User className="h-3.5 w-3.5 text-white/70" />
        </div>
      )}
    </div>
  )
}

// ─── Markdown-lite renderer ───
// Soporta: **bold**, `code`, listas, headings #/##/###, líneas en blanco.

function FormattedText({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white [&_h3]:text-xs [&_h3]:text-blue-300 [&_h2]:text-sm [&_h2]:text-blue-300">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i}>{inline(line.slice(4))}</h3>
        if (line.startsWith('## '))  return <h2 key={i}>{inline(line.slice(3))}</h2>
        if (line.startsWith('# '))   return <h1 key={i}>{inline(line.slice(2))}</h1>
        const num = line.match(/^(\d+)\.\s(.+)/)
        if (num) return <li key={i} className="ml-4 list-decimal">{inline(num[2])}</li>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc">{inline(line.slice(2))}</li>
        if (line.trim() === '') return <br key={i} />
        return <p key={i}>{inline(line)}</p>
      })}
    </div>
  )
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-white/[0.10] px-1 py-0.5 text-[11px] text-blue-200">{part.slice(1, -1)}</code>
    }
    return part
  })
}
