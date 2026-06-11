'use client'

import { type FormEvent, type KeyboardEvent, useRef } from 'react'
import { Send } from 'lucide-react'

interface InputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
}

export function AnalystInput({ value, onChange, onSubmit, disabled, placeholder }: InputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim() || disabled) return
    onSubmit()
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!value.trim() || disabled) return
      onSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="glass flex-1 rounded-2xl px-4 py-2.5">
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder={placeholder ?? 'Pregunta sobre tus campañas...'}
          disabled={disabled}
          className="block w-full resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none disabled:opacity-60"
          style={{ maxHeight: '120px' }}
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="btn-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow-blue disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  )
}
