'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, Zap, FileText, Type, MousePointerClick, Video } from 'lucide-react'
import { ANGLE_LABELS, type CreativeAngle, type GeneratedCreatives, type UgcScript } from '../types'

interface OutputProps {
  data: GeneratedCreatives
  onCritique: (text: string, type: 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script') => void
}

export function CreativeOutput({ data, onCritique }: OutputProps) {
  return (
    <section className="space-y-5">
      <Group icon={Zap} label="Hooks" color="text-amber-300" count={data.hooks.length}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.hooks.map((h, i) => (
            <Card key={i} angle={h.angle}>
              <p className="text-sm font-semibold text-white">{h.text}</p>
              <Footer text={h.text} onCritique={() => onCritique(h.text, 'hook')} />
            </Card>
          ))}
        </div>
      </Group>

      <Group icon={FileText} label="Copies" color="text-blue-300" count={data.copies.length}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.copies.map((c, i) => (
            <Card key={i} angle={c.angle}>
              <p className="whitespace-pre-line text-xs leading-relaxed text-white/85">{c.body}</p>
              <Footer text={c.body} onCritique={() => onCritique(c.body, 'copy')} />
            </Card>
          ))}
        </div>
      </Group>

      <Group icon={Type} label="Headlines" color="text-emerald-300" count={data.headlines.length}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {data.headlines.map((h, i) => (
            <Card key={i} angle={h.angle}>
              <p className="text-sm font-bold text-white">{h.text}</p>
              <Footer text={h.text} onCritique={() => onCritique(h.text, 'headline')} />
            </Card>
          ))}
        </div>
      </Group>

      <Group icon={MousePointerClick} label="CTAs" color="text-purple-300" count={data.ctas.length}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {data.ctas.map((c, i) => (
            <Card key={i} angle={c.angle}>
              <p className="text-sm font-bold text-white">{c.text}</p>
              <Footer text={c.text} onCritique={() => onCritique(c.text, 'cta')} />
            </Card>
          ))}
        </div>
      </Group>

      <Group icon={Video} label="Scripts UGC" color="text-pink-300" count={data.ugc_scripts.length}>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {data.ugc_scripts.map((s, i) => (
            <ScriptCard key={i} script={s} onCritique={() => onCritique(formatUgc(s), 'ugc_script')} />
          ))}
        </div>
      </Group>
    </section>
  )
}

function Group({
  icon: Icon, label, color, count, children,
}: {
  icon: typeof Zap
  label: string
  color: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <h3 className="text-sm font-bold tracking-tight text-white">{label}</h3>
        <span className="text-[10px] text-white/40">· {count}</span>
      </div>
      {children}
    </section>
  )
}

function Card({ angle, children }: { angle: CreativeAngle; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="mb-2 inline-block rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold tracking-wider text-white/50">
        {ANGLE_LABELS[angle].toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function ScriptCard({ script, onCritique }: { script: UgcScript; onCritique: () => void }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold tracking-wider text-white/50">
          {ANGLE_LABELS[script.angle].toUpperCase()}
        </span>
        <span className="rounded-full bg-pink-400/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-pink-200">
          {script.duration_seconds}s
        </span>
      </div>

      <div className="space-y-2.5">
        <Block label="Hook (3s)">{script.hook}</Block>
        <Block label="Body">{script.body}</Block>
        <Block label="CTA">{script.cta}</Block>
      </div>

      <Footer text={formatUgc(script)} onCritique={onCritique} />
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 whitespace-pre-line text-xs leading-snug text-white/85">{children}</p>
    </div>
  )
}

function Footer({ text, onCritique }: { text: string; onCritique: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-white"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <button
        type="button"
        onClick={onCritique}
        className="text-[10px] text-blue-300 hover:text-blue-200"
      >
        Critic →
      </button>
    </div>
  )
}

function formatUgc(s: UgcScript): string {
  return `[Hook ${s.duration_seconds}s] ${s.hook}\n\n[Body] ${s.body}\n\n[CTA] ${s.cta}`
}
